"""Test settings - applied BEFORE the app is imported."""

import os
import sys
from pathlib import Path

# Predictable, offline test environment (no real API keys are used)
os.environ["AI_SERVICE_KEY"] = "test-service-key"
os.environ["GROQ_API_KEY"] = ""          # rule-based mode: fast + deterministic
os.environ["USE_RAG"] = "false"          # keyword search: no ML models to load
os.environ["APP_ENV"] = "test"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
