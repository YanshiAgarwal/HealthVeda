"""
report_analyzer.py
------------------
Turns a lab report (PDF or text) into an easy-to-read health analysis:

    PDF ──► text ──► find lab values ──► compare with normal ranges
        ──► health score + concerns ──► Ayurvedic care for each concern
        ──► AI summary (Groq)  or  rule-based summary (no API key)
"""

import logging
import re

from services import ayurveda_knowledge as kb
from services.lab_reference import BLOOD_PRESSURE, LAB_TESTS
from services.llm_service import ask_llm_json, is_llm_available
from services.safety import DISCLAIMER

logger = logging.getLogger(__name__)

NUMBER = r"(\d[\d,]*(?:\.\d+)?)"   # 13.5  or  2,50,000

SAMPLE_REPORT = """
SHREE DIAGNOSTICS - COMPREHENSIVE HEALTH CHECKUP
Patient Name: Rahul Sharma        Age: 48 Years       Gender: Male
Report Date: 12/10/2026           Ref. By: Dr. A. Mehta

COMPLETE BLOOD COUNT
Hemoglobin            11.2   g/dL        13.0 - 17.0
RBC Count             4.1    million/uL  4.5 - 5.9
Total WBC Count       7,800  cells/uL    4000 - 11000
Platelet Count        2,45,000 cells/uL  150000 - 450000

DIABETES PROFILE
Fasting Blood Sugar   118    mg/dL       70 - 99
HbA1c                 6.1    %           4.0 - 5.6

LIPID PROFILE
Total Cholesterol     238    mg/dL       < 200
HDL Cholesterol       38     mg/dL       > 40
LDL Cholesterol       162    mg/dL       < 100
Triglycerides         190    mg/dL       < 150

KIDNEY FUNCTION
Serum Creatinine      1.0    mg/dL       0.6 - 1.3
Uric Acid             7.6    mg/dL       3.4 - 7.0

LIVER FUNCTION
SGPT (ALT)            48     U/L         7 - 56
SGOT (AST)            35     U/L         10 - 40

THYROID & VITAMINS
TSH                   2.8    mIU/L       0.4 - 4.0
Vitamin D (25-OH)     18     ng/mL       30 - 100
Vitamin B12           410    pg/mL       200 - 900

VITALS
Blood Pressure: 142/92 mmHg     Pulse: 78 bpm     BMI: 27.4 kg/m2
"""


# (Getting text out of PDFs / photos lives in document_reader.py)

# ── 2. Finding values ────────────────────────────────────────────────────
def _to_number(raw: str) -> float:
    return float(raw.replace(",", ""))


def _fix_scale(key: str, value: float) -> float:
    """Labs write counts differently (7.8 x10³ vs 7800). Make them consistent."""
    if key == "wbc" and value < 100:
        return value * 1000            # 7.8 (thousand) -> 7800
    if key == "platelets":
        if value < 10:
            return value * 100000      # 2.5 (lakh) -> 250000
        if value < 1000:
            return value * 1000        # 250 (thousand) -> 250000
    return value


def _status(value, low, high):
    """Return ('normal'|'low'|'high', 'normal'|'borderline'|'abnormal')."""
    if low is not None and value < low:
        gap = (low - value) / low
        return "low", "borderline" if gap <= 0.15 else "abnormal"
    if high is not None and value > high:
        gap = (value - high) / high
        return "high", "borderline" if gap <= 0.15 else "abnormal"
    return "normal", "normal"


def _plausibility(test, value):
    """
    Safety net for OCR mistakes: a missing decimal point turns "2.1" into "21".
    Values far outside anything plausible (5x the standard limits) are FLAGGED
    for the user to double-check - never silently changed, because a truly
    extreme value can be real and important.
    Returns (needs_check, hint) e.g. (True, "Did you mean 2.1?").
    """
    low, high = test["low"], test["high"]
    too_high = high is not None and value > high * 5
    too_low = low is not None and 0 < value < low / 5
    if not (too_high or too_low):
        return False, None
    hint = None
    for factor in (10, 100) if too_high else (0.1,):
        guess = value / factor
        if (low is None or guess >= low * 0.5) and (high is None or guess <= high * 2):
            hint = f"Did you mean {round(guess, 2):g}?"
            break
    return True, hint


def _make_result(test, value, report_range=None):
    """report_range = (low, high) printed on the lab report, if we found one."""
    low, high, source = test["low"], test["high"], "standard"
    if report_range:
        low, high, source = report_range[0], report_range[1], "report"
    status, severity = _status(value, low, high)
    needs_check, hint = _plausibility(test, value)
    return {
        "key": test["key"], "name": test["name"], "category": test.get("category", "Vitals"),
        "value": round(value, 2), "unit": test["unit"],
        "low": low, "high": high, "range_source": source,
        "status": status, "severity": severity, "info": test["info"],
        "check": needs_check, "check_hint": hint,
    }


RANGE_BETWEEN = re.compile(r"(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)")
RANGE_BELOW = re.compile(r"(?:<=?|≤|less than|up\s*to|below)\s*(\d+(?:\.\d+)?)")
RANGE_ABOVE = re.compile(r"(?:>=?|≥|more than|greater than|above)\s*(\d+(?:\.\d+)?)")


def _range_from_line(rest_of_line: str, test: dict, scale: float):
    """
    Look for the lab's own reference range AFTER the value on the same line,
    e.g. "13.5 g/dL   13.0 - 17.0"  or  "238 mg/dL  < 200".
    Returns (low, high) or None. Ranges that look wrong are ignored.
    """
    rest = rest_of_line.replace(",", "")
    low = high = None
    if match := RANGE_BETWEEN.search(rest):
        low, high = float(match.group(1)), float(match.group(2))
        if low >= high:
            return None
    elif match := RANGE_BELOW.search(rest):
        high = float(match.group(1))
    elif match := RANGE_ABOVE.search(rest):
        low = float(match.group(1))
    else:
        return None

    # Same unit conversion as the value (e.g. WBC "4.0 - 11.0" thousand)
    low = low * scale if low is not None else None
    high = high * scale if high is not None else None

    # Sanity check against the standard range: must be the same ballpark (x5)
    for found, standard in ((low, test["low"]), (high, test["high"])):
        if found is not None and standard:
            if not (standard / 5 <= found <= standard * 5):
                return None
    return low, high


def find_lab_values(text: str) -> list[dict]:
    """Search the report text for every test in LAB_TESTS."""
    lowered = text.lower()
    results = []

    for test in LAB_TESTS:
        for alias in test["aliases"]:
            # test name, then up to 40 non-digit characters, then the number
            match = re.search(alias + r"[^\d]{0,40}?" + NUMBER, lowered)
            if match:
                raw = _to_number(match.group(1))
                value = _fix_scale(test["key"], raw)
                line_end = lowered.find("\n", match.end())
                rest = lowered[match.end(): line_end if line_end != -1 else None]
                report_range = _range_from_line(rest, test, value / raw if raw else 1)
                results.append(_make_result(test, value, report_range))
                break

    bp = re.search(r"(?:blood\s+pressure|\bb\.?p\b\.?)[^\d]{0,20}(\d{2,3})\s*/\s*(\d{2,3})", lowered)
    if bp:
        for part, raw in (("systolic", bp.group(1)), ("diastolic", bp.group(2))):
            results.append(_make_result(BLOOD_PRESSURE[part], float(raw)))
    return results


def find_patient_info(text: str) -> dict:
    info = {}
    name = re.search(r"(?:patient(?:'s)?\s*name|name)\s*[:\-]\s*([A-Za-z][A-Za-z .]{1,40}?)(?:\s{2,}|\n|age|$)",
                     text, re.IGNORECASE)
    age = re.search(r"\bage\b\s*[:\-/]?\s*(\d{1,3})", text, re.IGNORECASE)
    gender = re.search(r"\b(?:gender|sex)\b\s*[:\-]?\s*(male|female|m|f)\b", text, re.IGNORECASE)
    if name:
        info["name"] = name.group(1).strip().title()
    if age:
        info["age"] = int(age.group(1))
    if gender:
        info["gender"] = "Male" if gender.group(1).lower().startswith("m") else "Female"
    return info


# ── 3. Interpreting values ───────────────────────────────────────────────
def _in_diabetic_range(result: dict) -> bool:
    return ((result["key"] == "glucose" and result["value"] >= 126)
            or (result["key"] == "hba1c" and result["value"] >= 6.5))


def find_concerns(tests: list[dict]) -> list[dict]:
    """Group abnormal values into health concerns + attach Ayurvedic care."""
    rules = {t["key"]: t for t in LAB_TESTS}
    concerns = {}

    for result in tests:
        if result["status"] == "normal":
            continue
        if result["key"].startswith("bp_"):
            rule = BLOOD_PRESSURE["if_high"] if result["status"] == "high" else None
        else:
            rule = rules[result["key"]].get(f"if_{result['status']}")
        if not rule:
            continue

        name, ayurveda_name = rule
        # Sugar only slightly high (glucose 100-125 / HbA1c 5.7-6.4) = Prediabetes
        if name == "Diabetes" and not _in_diabetic_range(result):
            name = "Prediabetes"

        concern = concerns.setdefault(name, {
            "name": name, "evidence": [], "severity": "borderline",
            "ayurveda": kb.get_profile(ayurveda_name) if ayurveda_name else None,
        })
        concern["evidence"].append(f"{result['name']}: {result['value']} {result['unit']} ({result['status']})")
        if result["severity"] == "abnormal":
            concern["severity"] = "abnormal"

    # If one value says Diabetes and another Prediabetes, keep just Diabetes
    if "Diabetes" in concerns and "Prediabetes" in concerns:
        concerns["Diabetes"]["evidence"] += concerns.pop("Prediabetes")["evidence"]

    return sorted(concerns.values(), key=lambda c: c["severity"] != "abnormal")


def health_score(tests: list[dict]) -> tuple[int, str]:
    """Weighted % of healthy values: normal = 1 point, borderline = 0.6,
    abnormal = 0.25.  Returns (score 0-100, risk level)."""
    if not tests:
        return 0, "Unknown"
    points = {"normal": 1.0, "borderline": 0.6, "abnormal": 0.25}
    score = round(100 * sum(points[t["severity"]] for t in tests) / len(tests))
    level = "Low" if score >= 80 else "Moderate" if score >= 60 else "High"
    return score, level


def category_overview(tests: list[dict]) -> list[dict]:
    overview = {}
    for t in tests:
        item = overview.setdefault(t["category"], {"category": t["category"], "total": 0, "normal": 0})
        item["total"] += 1
        item["normal"] += t["status"] == "normal"
    return list(overview.values())


# ── 4. Summaries ─────────────────────────────────────────────────────────
def rule_based_summary(tests, concerns, score) -> dict:
    abnormal = [t for t in tests if t["status"] != "normal"]
    key_points = [
        f"{t['name']} is {t['status']} at {t['value']} {t['unit']}. {t['info']}"
        for t in abnormal
    ] or ["All detected values are within the normal range. Great job!"]

    recs = []
    for c in concerns:
        profile = c.get("ayurveda")
        if profile and profile.get("diet"):
            recs.append(f"For {c['name'].lower()}: {profile['diet']}")
    recs += ["Walk or exercise for at least 30 minutes a day.",
             "Sleep 7-8 hours and keep regular meal times (Dinacharya).",
             "Repeat abnormal tests after 3 months to track progress."]

    normal = len(tests) - len(abnormal)
    return {
        "overview": f"We found {len(tests)} lab value{'s' * (len(tests) != 1)} in your report. "
                    f"{normal} {'is' if normal == 1 else 'are'} normal and {len(abnormal)} "
                    f"need{'s' * (len(abnormal) == 1)} attention. "
                    f"Your HealthVeda score is {score}/100.",
        "key_points": key_points[:8],
        "recommendations": recs[:6],
        "doctor_questions": [f"What should I do about my {c['name'].lower()}?" for c in concerns][:3]
                            + ["When should I repeat these tests?"],
    }


def ai_summary(text, tests, concerns) -> dict:
    values = "\n".join(f"- {t['name']}: {t['value']} {t['unit']} -> {t['status']}" for t in tests)
    prompt = f"""You are HealthVeda, a friendly health assistant explaining a lab report to a patient.
Use ONLY the information below. Do not invent values or diagnoses.

Extracted values:
{values or "(none found)"}

Possible concerns: {", ".join(c["name"] for c in concerns) or "none"}

Report text (may be partial):
{text[:3000]}

Return JSON with exactly these keys:
{{
  "overview": "2-3 simple sentences about the overall picture",
  "key_points": ["one simple sentence per important finding"],
  "recommendations": ["practical diet/lifestyle tips, Ayurvedic where suitable"],
  "doctor_questions": ["questions the patient should ask their doctor"]
}}"""
    return ask_llm_json(prompt)


# ── Main entry point ─────────────────────────────────────────────────────
def analyze_report_text(text: str) -> dict:
    tests = find_lab_values(text)
    concerns = find_concerns(tests)
    score, level = health_score(tests)

    summary, ai_powered = None, False
    if is_llm_available():
        try:
            summary = ai_summary(text, tests, concerns)
            ai_powered = True
        except Exception as error:
            logger.warning("AI summary failed, using rule-based summary: %s", error)
    if summary is None:
        summary = rule_based_summary(tests, concerns, score)

    flagged = [t["name"] for t in tests if t.get("check")]
    if flagged:
        summary.setdefault("key_points", []).insert(0,
            f"Please double-check {', '.join(flagged)} against your paper report - the value "
            "looks unusual and may have been misread (for example a missing decimal point).")

    return {
        "patient": find_patient_info(text),
        "tests": tests,
        "health_score": score,
        "risk_level": level,
        "categories": category_overview(tests),
        "concerns": concerns,
        "summary": summary,
        "ai_powered": ai_powered,
        "disclaimer": DISCLAIMER,
    }
