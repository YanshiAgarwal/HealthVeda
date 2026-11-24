"""
llm_service.py
--------------
A tiny wrapper around the Groq LLM API (Llama 3.3 70B).

Every feature that needs AI text calls `ask_llm(...)` from here, so if you
ever want to switch AI provider you only change THIS file.
"""

import json
import logging

from config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

_client = None  # created on first use


def is_llm_available() -> bool:
    """True when a Groq API key is configured."""
    return bool(GROQ_API_KEY)


def _get_client():
    global _client
    if _client is None:
        from groq import Groq  # imported here so the app still starts without it
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


def _extra_options() -> dict:
    """'Thinking' models (gpt-oss) reason before answering. Low effort = faster."""
    return {"reasoning_effort": "low"} if "gpt-oss" in GROQ_MODEL else {}


def ask_llm(prompt: str, system: str = "", temperature: float = 0.1,
            max_tokens: int = 700) -> str:
    """Send a prompt to the LLM and return its text reply."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = _get_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        **_extra_options(),
    )
    return (response.choices[0].message.content or "").strip()


def ask_llm_json(prompt: str, system: str = "", max_tokens: int = 1500) -> dict:
    """Ask the LLM for a JSON object and return it as a Python dict."""
    response = _get_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system or "Reply only with valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        **_extra_options(),
    )
    return json.loads(response.choices[0].message.content)
