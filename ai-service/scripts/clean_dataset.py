"""
Step 1 of 3 (only needed if you change the dataset):
Keep the 13 useful columns of data/ayurveda_dataset.csv
and save them as data/ayurveda_clean.csv.

Run from the backend folder:   python scripts/clean_dataset.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from config import CLEAN_DATASET, RAW_DATASET  # noqa: E402

KEEP_COLUMNS = [
    "Disease", "Symptoms", "Diagnosis & Tests", "Formulation", "Ayurvedic Herbs",
    "Herbal/Alternative Remedies", "Doshas", "Diet and Lifestyle Recommendations",
    "Yoga & Physical Therapy", "Medical Intervention", "Prevention",
    "Complications", "Patient Recommendations",
]


def main():
    df = pd.read_csv(RAW_DATASET)
    df = df[KEEP_COLUMNS].dropna(subset=["Disease", "Symptoms"])
    for column in df.columns:
        df[column] = df[column].astype(str).str.strip()
    df.to_csv(CLEAN_DATASET, index=False)
    print(f"Saved {len(df)} rows to {CLEAN_DATASET}")


if __name__ == "__main__":
    main()
