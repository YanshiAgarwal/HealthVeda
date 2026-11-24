"""
Step 2 of 3: build the SYMPTOM vector database from data/ayurveda_clean.csv.

Each condition becomes one "document" that is turned into a vector
(a list of numbers that captures its meaning) and stored in Chroma at
vector_db/symptom_db. The chatbot searches it to match symptoms.

Run from the backend folder:   python scripts/build_symptom_db.py
"""

import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402
from langchain_community.embeddings import HuggingFaceEmbeddings  # noqa: E402
from langchain_community.vectorstores import Chroma  # noqa: E402
from langchain_core.documents import Document  # noqa: E402

from config import CLEAN_DATASET, EMBEDDING_MODEL, SYMPTOM_DB_DIR  # noqa: E402


def safe(value) -> str:
    return "N/A" if pd.isna(value) else str(value).strip()


def main():
    df = pd.read_csv(CLEAN_DATASET)
    print(f"Loaded {len(df)} conditions")

    documents = []
    for _, row in df.iterrows():
        text = f"""Disease: {safe(row['Disease'])}
Symptoms: {safe(row['Symptoms'])}
Doshas: {safe(row['Doshas'])}
Diagnosis & Tests: {safe(row['Diagnosis & Tests'])}
Ayurvedic Herbs: {safe(row['Ayurvedic Herbs'])}
Formulation: {safe(row['Formulation'])}
Herbal/Alternative Remedies: {safe(row['Herbal/Alternative Remedies'])}
Diet and Lifestyle: {safe(row['Diet and Lifestyle Recommendations'])}
Yoga & Physical Therapy: {safe(row['Yoga & Physical Therapy'])}
Prevention: {safe(row['Prevention'])}
Complications: {safe(row['Complications'])}
Medical Intervention: {safe(row['Medical Intervention'])}
Patient Recommendations: {safe(row['Patient Recommendations'])}"""
        documents.append(Document(page_content=text, metadata={
            "disease": safe(row["Disease"]),
            "doshas": safe(row["Doshas"]),
            "herbs": safe(row["Ayurvedic Herbs"]),
        }))

    if SYMPTOM_DB_DIR.exists():
        shutil.rmtree(SYMPTOM_DB_DIR)  # start fresh, avoid duplicate entries

    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL,
                                       encode_kwargs={"normalize_embeddings": True})
    Chroma.from_documents(documents, embeddings, persist_directory=str(SYMPTOM_DB_DIR))
    print(f"Symptom DB saved to {SYMPTOM_DB_DIR}")


if __name__ == "__main__":
    main()
