"""
lab_reference.py
----------------
A table of common lab tests with their normal adult ranges.

Each entry tells the report analyzer:
  * aliases  - regex patterns that find the test name in report text
               (tried in order; the number right after the name is the value)
  * low/high - normal range (None = no limit on that side)
  * if_low / if_high - (friendly concern name, matching condition in the
               Ayurveda dataset or None)

Ranges are typical adult reference values for EDUCATIONAL use. Real labs
print their own ranges - always follow your lab and doctor.
To support a new test, just add one more dictionary to LAB_TESTS.
"""

LAB_TESTS = [
    # ── Blood count ──────────────────────────────────────────────────────
    {"key": "hemoglobin", "name": "Hemoglobin", "category": "Blood",
     "aliases": [r"(?<!glycated )(?<!glycosylated )\bha?emoglobin\b", r"\bhgb\b", r"\bhb\b"],
     "unit": "g/dL", "low": 12.0, "high": 17.0,
     "info": "Carries oxygen in your blood.",
     "if_low": ("Anemia", "Anemia"), "if_high": None},
    {"key": "rbc", "name": "RBC Count", "category": "Blood",
     "aliases": [r"\brbc(?:\s*count)?\b", r"red\s+blood\s+cells?(?:\s*count)?"],
     "unit": "million/µL", "low": 4.0, "high": 5.9,
     "info": "Number of red blood cells.",
     "if_low": ("Anemia", "Anemia"), "if_high": None},
    {"key": "wbc", "name": "WBC Count", "category": "Blood",
     "aliases": [r"total\s+(?:wbc|leu[ck]ocyte)\s*count", r"\bwbc(?:\s*count)?\b",
                 r"white\s+blood\s+cells?(?:\s*count)?", r"\btlc\b"],
     "unit": "cells/µL", "low": 4000, "high": 11000,
     "info": "Immune cells that fight infection.",
     "if_low": ("Low Immunity Markers", None), "if_high": ("Possible Infection", None)},
    {"key": "platelets", "name": "Platelet Count", "category": "Blood",
     "aliases": [r"platelets?(?:\s*count)?"],
     "unit": "cells/µL", "low": 150000, "high": 450000,
     "info": "Help your blood clot.",
     "if_low": ("Low Platelets", None), "if_high": None},

    # ── Blood sugar ──────────────────────────────────────────────────────
    {"key": "glucose", "name": "Fasting Glucose", "category": "Sugar",
     "aliases": [r"fasting\s+(?:blood\s+|plasma\s+)?(?:glucose|sugar)", r"\bfbs\b",
                 r"\bglucose\b", r"blood\s+sugar"],
     "unit": "mg/dL", "low": 70, "high": 99,
     "info": "Sugar level after 8+ hours without food.",
     "if_low": ("Low Blood Sugar", None), "if_high": ("Diabetes", "Diabetes")},
    {"key": "hba1c", "name": "HbA1c", "category": "Sugar",
     "aliases": [r"\bhba1c\b", r"glycated\s+ha?emoglobin", r"\ba1c\b"],
     "unit": "%", "low": 4.0, "high": 5.6,
     "info": "Average blood sugar over the last 3 months.",
     "if_low": None, "if_high": ("Diabetes", "Diabetes")},

    # ── Heart & cholesterol ──────────────────────────────────────────────
    {"key": "cholesterol", "name": "Total Cholesterol", "category": "Heart",
     "aliases": [r"total\s+cholesterol", r"cholesterol[,\s]+total",
                 r"(?<!hdl )(?<!ldl )(?<!hdl-)(?<!ldl-)(?<!vldl )\bcholesterol\b"],
     "unit": "mg/dL", "low": None, "high": 199,
     "info": "All cholesterol in your blood.",
     "if_low": None, "if_high": ("High Cholesterol", "Hypercholesterolemia")},
    {"key": "ldl", "name": "LDL (Bad) Cholesterol", "category": "Heart",
     "aliases": [r"\bldl(?:[\s-]*cholesterol)?\b"],
     "unit": "mg/dL", "low": None, "high": 99,
     "info": "'Bad' cholesterol that can block arteries.",
     "if_low": None, "if_high": ("High Cholesterol", "Hypercholesterolemia")},
    {"key": "hdl", "name": "HDL (Good) Cholesterol", "category": "Heart",
     "aliases": [r"\bhdl(?:[\s-]*cholesterol)?\b"],
     "unit": "mg/dL", "low": 40, "high": None,
     "info": "'Good' cholesterol that protects the heart.",
     "if_low": ("High Cholesterol", "Hypercholesterolemia"), "if_high": None},
    {"key": "triglycerides", "name": "Triglycerides", "category": "Heart",
     "aliases": [r"triglycerides?", r"\btg\b"],
     "unit": "mg/dL", "low": None, "high": 149,
     "info": "Fat in the blood, raised by sugar and alcohol.",
     "if_low": None, "if_high": ("High Triglycerides", "Hyperlipidemia")},

    # ── Kidney ───────────────────────────────────────────────────────────
    {"key": "creatinine", "name": "Creatinine", "category": "Kidney",
     "aliases": [r"(?:serum\s+)?creatinine"],
     "unit": "mg/dL", "low": 0.6, "high": 1.3,
     "info": "Waste product filtered by the kidneys.",
     "if_low": None, "if_high": ("Kidney Function Concern", "Chronic Kidney Disease (CKD)")},
    {"key": "bun", "name": "Blood Urea Nitrogen", "category": "Kidney",
     "aliases": [r"\bbun\b", r"blood\s+urea\s+nitrogen"],
     "unit": "mg/dL", "low": 7, "high": 20,
     "info": "Another kidney waste marker.",
     "if_low": None, "if_high": ("Kidney Function Concern", "Chronic Kidney Disease (CKD)")},
    {"key": "uric_acid", "name": "Uric Acid", "category": "Kidney",
     "aliases": [r"uric\s+acid"],
     "unit": "mg/dL", "low": 3.4, "high": 7.0,
     "info": "High levels can cause gout (joint pain).",
     "if_low": None, "if_high": ("High Uric Acid", "Gout")},

    # ── Liver ────────────────────────────────────────────────────────────
    {"key": "alt", "name": "ALT (SGPT)", "category": "Liver",
     "aliases": [r"\bsgpt\b", r"\balt\b", r"alanine\s+aminotransferase"],
     "unit": "U/L", "low": 7, "high": 56,
     "info": "Liver enzyme - rises when liver cells are stressed.",
     "if_low": None, "if_high": ("Liver Function Concern", "Liver Disorders")},
    {"key": "ast", "name": "AST (SGOT)", "category": "Liver",
     "aliases": [r"\bsgot\b", r"\bast\b", r"aspartate\s+aminotransferase"],
     "unit": "U/L", "low": 10, "high": 40,
     "info": "Liver and muscle enzyme.",
     "if_low": None, "if_high": ("Liver Function Concern", "Liver Disorders")},
    {"key": "bilirubin", "name": "Total Bilirubin", "category": "Liver",
     "aliases": [r"total\s+bilirubin", r"bilirubin[,\s]+total",
                 r"(?<!direct )(?<!indirect )\bbilirubin\b"],
     "unit": "mg/dL", "low": 0.2, "high": 1.2,
     "info": "Yellow pigment; high levels cause jaundice.",
     "if_low": None, "if_high": ("Liver Function Concern", "Liver Disorders")},

    # ── Thyroid ──────────────────────────────────────────────────────────
    {"key": "tsh", "name": "TSH", "category": "Thyroid",
     "aliases": [r"\btsh\b", r"thyroid\s+stimulating\s+hormone"],
     "unit": "mIU/L", "low": 0.4, "high": 4.0,
     "info": "Controls your thyroid gland.",
     "if_low": ("Overactive Thyroid", "Hyperthyroidism"),
     "if_high": ("Underactive Thyroid", "Hypothyroidism")},

    # ── Vitamins & minerals ──────────────────────────────────────────────
    {"key": "vitamin_d", "name": "Vitamin D", "category": "Vitamins",
     "aliases": [r"vitamin\s*d3?(?:\s*\(?\s*25[\s-]*(?:oh|hydroxy)\s*\)?)?",
                 r"25[\s-]*(?:oh|hydroxy)[\s-]*vitamin\s*d3?"],
     "unit": "ng/mL", "low": 30, "high": 100,
     "info": "Needed for strong bones and immunity.",
     "if_low": ("Vitamin D Deficiency", None), "if_high": None},
    {"key": "vitamin_b12", "name": "Vitamin B12", "category": "Vitamins",
     "aliases": [r"vitamin\s*b[\s-]?12", r"cobalamin"],
     "unit": "pg/mL", "low": 200, "high": 900,
     "info": "Needed for nerves and red blood cells.",
     "if_low": ("Vitamin B12 Deficiency", None), "if_high": None},
    {"key": "calcium", "name": "Calcium", "category": "Vitamins",
     "aliases": [r"(?:serum\s+)?calcium"],
     "unit": "mg/dL", "low": 8.5, "high": 10.5,
     "info": "Bones, muscles and nerves need it.",
     "if_low": None, "if_high": None},

    # ── Vitals ───────────────────────────────────────────────────────────
    {"key": "heart_rate", "name": "Heart Rate", "category": "Vitals",
     "aliases": [r"heart\s+rate", r"pulse(?:\s+rate)?"],
     "unit": "bpm", "low": 60, "high": 100,
     "info": "Heartbeats per minute at rest.",
     "if_low": None, "if_high": None},
    {"key": "bmi", "name": "BMI", "category": "Vitals",
     "aliases": [r"\bbmi\b", r"body\s+mass\s+index"],
     "unit": "kg/m²", "low": 18.5, "high": 24.9,
     "info": "Weight compared with height.",
     "if_low": ("Underweight", None), "if_high": ("Overweight / Obesity", "Obesity")},
]

# Blood pressure is written as "130/85", so it is handled separately.
BLOOD_PRESSURE = {
    "systolic": {"key": "bp_systolic", "name": "Systolic BP", "unit": "mmHg",
                 "low": 90, "high": 120, "info": "Pressure when the heart beats."},
    "diastolic": {"key": "bp_diastolic", "name": "Diastolic BP", "unit": "mmHg",
                  "low": 60, "high": 80, "info": "Pressure between heartbeats."},
    "if_high": ("High Blood Pressure", "Hypertension"),
}
