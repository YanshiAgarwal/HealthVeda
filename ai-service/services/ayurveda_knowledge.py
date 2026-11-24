"""
ayurveda_knowledge.py
---------------------
Reads the Ayurveda dataset (data/ayurveda_clean.csv) and lets other code:

  * find the full profile of a condition     -> get_profile("Diabetes")
  * search conditions by symptoms (keywords)  -> keyword_search("cough cold")
  * list every condition                      -> list_conditions()

This is plain Python (no AI), so it always works - even with no API key.
"""

import csv
import difflib
import re
from functools import lru_cache

from config import CLEAN_DATASET

# CSV column  ->  short key used in our API / frontend
COLUMN_MAP = {
    "Disease": "disease",
    "Symptoms": "symptoms",
    "Diagnosis & Tests": "tests",
    "Formulation": "formulation",
    "Ayurvedic Herbs": "herbs",
    "Herbal/Alternative Remedies": "remedies",
    "Doshas": "doshas",
    "Diet and Lifestyle Recommendations": "diet",
    "Yoga & Physical Therapy": "yoga",
    "Medical Intervention": "medical",
    "Prevention": "prevention",
    "Complications": "complications",
    "Patient Recommendations": "advice",
}

STOP_WORDS = {
    "the", "and", "have", "has", "had", "with", "for", "from", "since", "about",
    "what", "which", "how", "can", "should", "feel", "feeling", "having", "very",
    "some", "also", "days", "day", "week", "weeks", "my", "me", "i", "am", "is",
    "are", "a", "an", "of", "in", "on", "to", "it", "this", "that", "pain", "please",
}


@lru_cache(maxsize=1)
def load_conditions() -> list[dict]:
    """Load the CSV once and keep it in memory."""
    rows = []
    with open(CLEAN_DATASET, encoding="utf-8-sig", newline="") as f:
        for raw in csv.DictReader(f):
            row = {key: (raw.get(col) or "").strip() for col, key in COLUMN_MAP.items()}
            if row["disease"] and row["disease"].lower() != "disease":
                rows.append(row)
    return rows


def list_conditions(search: str = "", limit: int = 60) -> list[dict]:
    """Short cards for the Remedy Explorer page, optionally filtered."""
    search = search.lower().strip()
    results, seen = [], set()
    for row in load_conditions():
        name_key = row["disease"].lower()
        if name_key in seen:
            continue
        haystack = f"{row['disease']} {row['symptoms']} {row['herbs']}".lower()
        if search and search not in haystack:
            continue
        seen.add(name_key)
        results.append({
            "disease": row["disease"],
            "symptoms": row["symptoms"],
            "doshas": row["doshas"],
            "herbs": row["herbs"],
        })
        if len(results) >= limit:
            break
    return results


def get_profile(name: str) -> dict | None:
    """Return the full Ayurvedic profile of a condition (fuzzy name match)."""
    if not name or name.upper() in ("UNKNOWN", "EMERGENCY"):
        return None
    rows = load_conditions()
    target = name.lower().strip()

    # 1. exact match  2. partial match  3. closest spelling
    for row in rows:
        if row["disease"].lower() == target:
            return row
    for row in rows:
        if target in row["disease"].lower() or row["disease"].lower() in target:
            return row
    names = [r["disease"] for r in rows]
    close = difflib.get_close_matches(name, names, n=1, cutoff=0.6)
    if close:
        return next(r for r in rows if r["disease"] == close[0])
    return None


def keyword_search(query: str, top_k: int = 3) -> list[dict]:
    """Very simple symptom search: count matching words. Used as a fallback."""
    words = {w for w in re.findall(r"[a-z]+", query.lower())
             if len(w) > 2 and w not in STOP_WORDS}
    if not words:
        return []

    scored = []
    for row in load_conditions():
        name = row["disease"].lower()
        symptoms = row["symptoms"].lower()
        score = sum(3 for w in words if w in name) + sum(1 for w in words if w in symptoms)
        if score:
            scored.append((score, row))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [row for _, row in scored[:top_k]]


def profile_to_text(row: dict) -> str:
    """Turn a profile into plain text that we can give to the LLM as context."""
    return "\n".join(f"{col}: {row[key]}" for col, key in COLUMN_MAP.items() if row.get(key))


def template_answer(row: dict) -> str:
    """A friendly answer built only from the dataset (used when no LLM key)."""
    parts = [f"Your symptoms are closest to {row['disease']} in our Ayurvedic knowledge base."]
    if row["doshas"]:
        parts.append(f"In Ayurveda this is linked to an imbalance of {row['doshas']} dosha.")
    if row["herbs"]:
        parts.append(f"Helpful herbs include {row['herbs']}.")
    if row["formulation"]:
        parts.append(f"A common home formulation is {row['formulation']}.")
    if row["diet"]:
        parts.append(f"Diet and lifestyle: {row['diet']}")
    if row["yoga"]:
        parts.append(f"Yoga that may help: {row['yoga']}.")
    parts.append("Please consult a doctor if your symptoms continue or get worse.")
    return " ".join(parts)
