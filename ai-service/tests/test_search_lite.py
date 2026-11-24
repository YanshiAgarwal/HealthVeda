"""The serverless 'lite' search (NumPy index + ONNX embeddings + BM25)."""

import numpy as np
import pytest

pytest.importorskip("fastembed")

from services.search_lite import Embedder, LiteIndex, lite_index_available, tokenize  # noqa: E402


@pytest.fixture(scope="module")
def symptoms():
    if not lite_index_available():
        pytest.skip("vector_index/ not exported")
    return LiteIndex("symptom")


def test_index_files_are_consistent(symptoms):
    assert symptoms.vectors.shape == (len(symptoms.docs), 384)
    norms = np.linalg.norm(symptoms.vectors, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-3)              # normalised -> dot = cosine


def test_query_embedding_matches_stored_model(symptoms):
    # Re-embedding a stored document must give (almost) the same vector
    vector = Embedder.embed(symptoms.docs[0].page_content)
    assert float(vector @ symptoms.vectors[0]) > 0.99


@pytest.mark.parametrize("query,expected", [
    ("I have a dry cough and sore throat", "Cough"),
    ("acidity and burning in the chest after spicy food", "Acidity"),
])
def test_hybrid_search_finds_condition(symptoms, query, expected):
    hits = symptoms.search(query, top_k=4)
    assert any(expected.lower() in d.metadata.get("disease", "").lower() for d in hits)


def test_tokenize():
    assert tokenize("HbA1c is 6.5%!") == ["hba1c", "is", "6", "5"]
