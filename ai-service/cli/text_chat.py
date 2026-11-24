"""
text_chat.py - chat with the Veda Assistant in your terminal (no website).

Run from the backend folder:
    python cli/text_chat.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))  # lets us import backend modules

from services.ayurveda_rag import assistant  # noqa: E402


def main():
    print("Loading HealthVeda knowledge base (first run can take a minute)...")
    assistant.load()
    print(f"Ready! (search mode: {assistant.mode})\n")
    print("=" * 50)
    print("   HealthVeda - Your Ayurvedic Assistant")
    print("=" * 50)
    print("Type 'quit' to exit\n")

    history = []
    while True:
        query = input("You: ").strip()
        if not query:
            continue
        if query.lower() in ("quit", "exit", "bye"):
            print("HealthVeda: Take care and stay healthy!")
            break

        result = assistant.ask(query, history)
        print(f"\nHealthVeda [{result['condition']} | {result['source']}]:")
        print(result["answer"], "\n")
        history.append({"user": query, "bot": result["answer"]})


if __name__ == "__main__":
    main()
