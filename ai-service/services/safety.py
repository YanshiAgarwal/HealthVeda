"""
safety.py
---------
Medical safety rules. HealthVeda is an information tool, NOT a doctor,
so every answer path checks for emergencies first.
"""

EMERGENCY_KEYWORDS = [
    "chest pain",
    "difficulty breathing",
    "can't breathe",
    "cannot breathe",
    "unconscious",
    "stroke",
    "heart attack",
    "severe bleeding",
    "vomiting blood",
    "fainting",
    "seizure",
    "suicide",
    "kill myself",
]

EMERGENCY_MESSAGE = (
    "Your symptoms may indicate a medical emergency. Please seek immediate "
    "medical attention: call 112 (India emergency) or 108 (ambulance), "
    "or go to the nearest hospital right away."
)

DISCLAIMER = (
    "HealthVeda provides general wellness information only. It is not a "
    "substitute for professional medical advice, diagnosis or treatment."
)


def is_emergency(text: str) -> bool:
    """Return True if the text mentions an emergency symptom."""
    text = text.lower()
    return any(keyword in text for keyword in EMERGENCY_KEYWORDS)
