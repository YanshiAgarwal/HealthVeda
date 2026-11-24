"""
search_lite.py
--------------
A small, serverless-friendly version of the hybrid search (no torch, no Chroma).

    query ─┬─► ONNX embedding (fastembed, same BGE model) ─► cosine search in NumPy ─┐
           └─► BM25 keyword search ──────────────────────────────────────────────────┴─► RRF ─► top k

RRF = Reciprocal Rank Fusion: a document scores 1/(60 + rank) in each list and
the scores are added. Documents found by BOTH searches rise to the top.
It replaces the 1 GB cross-encoder re-ranker used in "full" mode.

The index files come from scripts/export_vector_index.py.
"""

import json
import os
import re
import shutil
import threading
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from config import BACKEND_DIR, EMBEDDING_MODEL, FASTEMBED_CACHE, IS_SERVERLESS, VECTOR_INDEX_DIR

BUNDLED_MODEL_DIR = BACKEND_DIR / "models" / "fastembed"   # filled at Vercel build time
RRF_K = 60
_TOKEN = re.compile(r"[a-z0-9]+")


@dataclass
class Doc:
    """Same shape as LangChain's Document, so the rest of the code doesn't care."""
    page_content: str
    metadata: dict = field(default_factory=dict)


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


class Embedder:
    """Turns a query into a normalised 384-number vector (BAAI/bge-small-en-v1.5, ONNX)."""

    _model = None
    _lock = threading.Lock()

    @classmethod
    def embed(cls, text: str) -> np.ndarray:
        with cls._lock:
            if cls._model is None:
                cls._model = cls._load()
        vector = np.asarray(next(iter(cls._model.embed([text]))), dtype=np.float32)
        return vector / np.linalg.norm(vector)

    @staticmethod
    def _load():
        from fastembed import TextEmbedding

        cache = Path(FASTEMBED_CACHE)
        # Serverless: the deployment is read-only, so copy the bundled model to /tmp once
        if IS_SERVERLESS and BUNDLED_MODEL_DIR.exists() and not cache.exists():
            shutil.copytree(BUNDLED_MODEL_DIR, cache)
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        return TextEmbedding(EMBEDDING_MODEL, cache_dir=str(cache))


class LiteIndex:
    """One searchable collection (e.g. 'symptom' or 'book')."""

    def __init__(self, name: str):
        self.vectors = np.load(VECTOR_INDEX_DIR / f"{name}.npy", allow_pickle=False)
        records = json.loads((VECTOR_INDEX_DIR / f"{name}.json").read_text(encoding="utf-8"))
        self.docs = [Doc(r["text"], r.get("metadata", {})) for r in records]

        from rank_bm25 import BM25Okapi
        self.bm25 = BM25Okapi([tokenize(d.page_content) for d in self.docs])

    def search(self, query: str, top_k: int = 4, candidates: int = 20) -> list[Doc]:
        # 1. meaning-based search
        query_vector = Embedder.embed(query)
        by_vector = np.argsort(-(self.vectors @ query_vector))[:candidates]
        # 2. keyword search
        by_keyword = np.argsort(-self.bm25.get_scores(tokenize(query)))[:candidates]
        # 3. fuse the two ranked lists
        scores: dict[int, float] = {}
        for ranking in (by_vector, by_keyword):
            for rank, index in enumerate(ranking):
                scores[int(index)] = scores.get(int(index), 0.0) + 1.0 / (RRF_K + rank + 1)
        best = sorted(scores, key=scores.get, reverse=True)[:top_k]
        return [self.docs[i] for i in best]


def lite_index_available() -> bool:
    return (VECTOR_INDEX_DIR / "symptom.npy").exists() and (VECTOR_INDEX_DIR / "book.npy").exists()
