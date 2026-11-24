"""
voice_chat.py - TALK to HealthVeda using your microphone, in 11 Indian languages.

Run from the backend folder:
    python cli/voice_chat.py

Needs: GROQ_API_KEY + SARVAM_API_KEY in backend/.env, a microphone,
speakers, and ffmpeg installed. Say "thank you" / "bye" / "shukriya" to exit.

Each turn:  listen -> English text -> Ayurveda assistant -> translate back
            -> speak the answer in the user's own language
"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.ayurveda_rag import assistant  # noqa: E402
from voice.phrases import get_phrase, is_exit_intent  # noqa: E402
from voice.sarvam_voice import (init_client, listen_and_transcribe,  # noqa: E402
                                speak, translate)


async def main():
    print("=" * 55)
    print("   🌿  HealthVeda Voice - Your Ayurvedic Assistant  🌿")
    print("=" * 55)

    language = "en-IN"
    client = init_client()

    # Greet first, then load the heavy models
    await speak(client, get_phrase("loading", language), language)
    print("⚙️  Loading knowledge base...")
    await asyncio.to_thread(assistant.load)
    print(f"✅ Ready (search mode: {assistant.mode})\n")
    await speak(client, get_phrase("ready", language), language)

    history = []
    while True:
        input("\n▶  Press ENTER, then speak...")

        try:
            question, language = await listen_and_transcribe(client)
        except Exception as error:
            print(f"❌ Could not hear you: {error}")
            continue
        if not question:
            print("⚠️  Nothing heard, try again.")
            continue

        if is_exit_intent(question):
            await speak(client, get_phrase("farewell", language), language)
            break

        # Say "let me think..." WHILE the assistant is working
        filler = get_phrase("acknowledged", language) + " " + get_phrase("thinking", language)
        result, _ = await asyncio.gather(
            asyncio.to_thread(assistant.ask, question, list(history), "English", "voice"),
            speak(client, filler, language),
        )

        print(f"📋 Condition: {result['condition']}  [{result['source']}]")
        answer_in_user_language = await translate(client, result["answer"], language)
        await speak(client, answer_in_user_language, language)

        history.append({"user": question, "bot": result["answer"]})


if __name__ == "__main__":
    asyncio.run(main())
