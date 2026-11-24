from services.report_analyzer import (SAMPLE_REPORT, analyze_report_text,
                                      find_lab_values, find_patient_info, health_score)


def values_by_key(text):
    return {t["key"]: t for t in find_lab_values(text)}


def test_sample_report_extracts_all_values():
    tests = values_by_key(SAMPLE_REPORT)
    assert len(tests) == 21
    assert tests["hemoglobin"]["value"] == 11.2
    assert tests["platelets"]["value"] == 245000       # "2,45,000" Indian format
    assert tests["glucose"]["value"] == 118
    assert tests["hba1c"]["value"] == 6.1
    assert tests["vitamin_d"]["value"] == 18            # not the "25" of "25-OH"
    assert tests["bp_systolic"]["value"] == 142
    assert tests["bp_diastolic"]["value"] == 92


def test_uses_reference_range_printed_on_report():
    tests = values_by_key(SAMPLE_REPORT)
    hb = tests["hemoglobin"]
    assert (hb["low"], hb["high"], hb["range_source"]) == (13.0, 17.0, "report")
    assert tests["cholesterol"]["high"] == 200          # from "< 200"
    assert tests["hdl"]["low"] == 40                    # from "> 40"
    assert tests["bp_systolic"]["range_source"] == "standard"


def test_falls_back_to_standard_range():
    t = values_by_key("Fasting Glucose: 92 mg/dL")["glucose"]
    assert t["range_source"] == "standard" and t["status"] == "normal"


def test_ignores_implausible_printed_range():
    # "1 - 3" is clearly not a hemoglobin range (probably a page number etc.)
    t = values_by_key("Hemoglobin 14.1 g/dL  1 - 3")["hemoglobin"]
    assert t["range_source"] == "standard"


def test_scales_wbc_and_its_range_together():
    t = values_by_key("Total WBC Count 7.8 x10^3/uL  4.0 - 11.0")["wbc"]
    assert t["value"] == 7800
    assert (t["low"], t["high"]) == (4000, 11000)


def test_no_false_cholesterol_from_hdl_line():
    tests = values_by_key("HDL Cholesterol 45 mg/dL")
    assert "cholesterol" not in tests and tests["hdl"]["value"] == 45


def test_glycated_hemoglobin_is_not_hemoglobin():
    tests = values_by_key("Glycated Haemoglobin (HbA1c) 6.8 %")
    assert "hemoglobin" not in tests and tests["hba1c"]["value"] == 6.8


def test_status_and_severity():
    tests = values_by_key("Fasting Glucose 105 mg/dL\nTriglycerides 300 mg/dL\nTSH 0.2")
    assert (tests["glucose"]["status"], tests["glucose"]["severity"]) == ("high", "borderline")
    assert (tests["triglycerides"]["status"], tests["triglycerides"]["severity"]) == ("high", "abnormal")
    assert tests["tsh"]["status"] == "low"


def test_prediabetes_vs_diabetes():
    pre = analyze_report_text("Fasting Glucose 110 mg/dL")["concerns"]
    assert [c["name"] for c in pre] == ["Prediabetes"]
    both = analyze_report_text("Fasting Glucose 110 mg/dL\nHbA1c 7.2 %")["concerns"]
    assert [c["name"] for c in both] == ["Diabetes"]
    assert len(both[0]["evidence"]) == 2


def test_concerns_link_to_ayurveda_profiles():
    result = analyze_report_text(SAMPLE_REPORT)
    names = {c["name"]: c for c in result["concerns"]}
    assert names["High Blood Pressure"]["ayurveda"]["disease"] == "Hypertension"
    assert names["Prediabetes"]["ayurveda"]["disease"] == "Diabetes"
    assert names["Vitamin D Deficiency"]["ayurveda"] is None


def test_health_score_bounds():
    assert health_score([]) == (0, "Unknown")
    normal = [{"severity": "normal"}] * 5
    assert health_score(normal) == (100, "Low")
    bad = [{"severity": "abnormal"}] * 4
    assert health_score(bad)[1] == "High"


def test_patient_info():
    info = find_patient_info(SAMPLE_REPORT)
    assert info == {"name": "Rahul Sharma", "age": 48, "gender": "Male"}


def test_rule_based_summary_without_llm():
    result = analyze_report_text(SAMPLE_REPORT)
    assert result["ai_powered"] is False
    assert "21 lab values" in result["summary"]["overview"]
    assert result["summary"]["doctor_questions"]


def test_flags_implausible_values_without_changing_them():
    # OCR dropped the decimal point: TSH "2.1" read as "21", Hb "10.9" as "109"
    tests = values_by_key("TSH 21 mIU/L\nHemoglobin 109 g/dL\nFasting Glucose 140 mg/dL")
    assert tests["tsh"]["value"] == 21 and tests["tsh"]["check"] is True
    assert tests["tsh"]["check_hint"] == "Did you mean 2.1?"
    assert tests["hemoglobin"]["check_hint"] == "Did you mean 10.9?"
    assert tests["glucose"]["check"] is False            # merely high, still plausible


def test_text_without_lab_values():
    result = analyze_report_text("Hello, this is just a letter with no values at all.")
    assert result["tests"] == [] and result["concerns"] == []
