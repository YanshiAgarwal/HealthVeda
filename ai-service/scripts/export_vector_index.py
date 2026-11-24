"""
Step 4 (after building the Chroma DBs): export them into a LIGHT vector index.

Why? Chroma + torch are far too big for serverless hosting (Vercel). The
exported index is just:
    vector_index/<name>.npy   -> the embedding vectors (float32, normalised)
    vector_index/<name>.json  -> the matching texts + metadata
(no pickle files, so loading them can never run code).

Run from the ai-service folder:   python scripts/export_vector_index.py
"""

import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from config import BOOK_DB_DIR, SYMPTOM_DB_DIR, VECTOR_INDEX_DIR  # noqa: E402


def export(chroma_dir: Path, name: str):
    import chromadb

    client = chromadb.PersistentClient(path=str(chroma_dir))
    collection = client.get_collection(client.list_collections()[0].name)
    data = collection.get(include=["embeddings", "documents", "metadatas"])

    vectors = np.asarray(data["embeddings"], dtype=np.float32)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)  # unit length -> dot = cosine
    docs = [{"text": t, "metadata": m or {}} for t, m in zip(data["documents"], data["metadatas"])]

    VECTOR_INDEX_DIR.mkdir(exist_ok=True)
    np.save(VECTOR_INDEX_DIR / f"{name}.npy", vectors)
    (VECTOR_INDEX_DIR / f"{name}.json").write_text(json.dumps(docs, ensure_ascii=False), encoding="utf-8")
    print(f"{name}: {len(docs)} vectors x {vectors.shape[1]} dims -> {VECTOR_INDEX_DIR}")


if __name__ == "__main__":
    export(SYMPTOM_DB_DIR, "symptom")
    export(BOOK_DB_DIR, "book")
