"""End-to-end API tests through FastAPI's TestClient."""

import pytest
from fastapi.testclient import TestClient

from main import app

KEY = {"X-Service-Key": "test-service-key"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_is_public(client):
    assert client.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("path", ["/api/status", "/api/reports/sample", "/api/conditions"])
def test_routes_require_service_key(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"X-Service-Key": "wrong"}).status_code == 401


def test_status(client):
    body = client.get("/api/status", headers=KEY).json()
    assert body["app"] == "HealthVeda" and body["ai_enabled"] is False


def test_sample_report(client):
    body = client.get("/api/reports/sample", headers=KEY).json()
    assert body["health_score"] > 0 and len(body["tests"]) == 21
    assert body["extraction"]["method"] == "sample"


def test_upload_text_report(client):
    files = {"file": ("r.txt", b"Fasting Glucose 140 mg/dL", "text/plain")}
    body = client.post("/api/reports/analyze", files=files, headers=KEY).json()
    assert body["concerns"][0]["name"] == "Diabetes"
    assert "extracted_text" in body


def test_upload_rejects_bad_file(client):
    files = {"file": ("x.pdf", b"MZ\x90\x00\x03\x00\xff\xfe", "application/pdf")}
    response = client.post("/api/reports/analyze", files=files, headers=KEY)
    assert response.status_code == 400


def test_upload_rejects_too_large(client):
    files = {"file": ("big.txt", b"a" * (10 * 1024 * 1024 + 10), "text/plain")}
    assert client.post("/api/reports/analyze", files=files, headers=KEY).status_code == 413


def test_chat_emergency(client):
    body = client.post("/api/chat", json={"message": "severe chest pain"}, headers=KEY).json()
    assert body["emergency"] is True


def test_chat_keyword_mode_with_report_context(client):
    body = client.post("/api/chat", headers=KEY, json={
        "message": "I have a cough and sore throat",
        "report_context": "Fasting Glucose 140 mg/dL (high)",
    }).json()
    assert body["mode"] == "keyword" and body["profile"] is not None
    assert "lab report" in body["answer"]


def test_chat_validation(client):
    assert client.post("/api/chat", json={"message": ""}, headers=KEY).status_code == 422
    assert client.post("/api/chat", json={"message": "x" * 1001}, headers=KEY).status_code == 422


def test_conditions(client):
    assert client.get("/api/conditions?search=cough&limit=3", headers=KEY).status_code == 200
    assert client.get("/api/conditions?limit=0", headers=KEY).status_code == 422
    assert client.get("/api/conditions/NotARealDisease123", headers=KEY).status_code == 404
