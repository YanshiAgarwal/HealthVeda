"""
phone_call_server.py - HealthVeda answers a real PHONE CALL (Twilio).

Setup (see README "Phone call mode"):
  1. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
     SARVAM_API_KEY and GROQ_API_KEY to backend/.env
  2. Terminal 1:  python cli/phone_call_server.py
  3. Terminal 2:  cloudflared tunnel --url http://localhost:8001
                  -> put the domain (without https://) in .env as DOMAIN=...
                  -> restart terminal 1
  4. Terminal 3:  python cli/phone_call_server.py +91XXXXXXXXXX

How a call works:
  Twilio calls the number -> /answer -> /connect -> /stream (WebSocket).
  We receive the caller's audio, detect when they stop talking, convert
  speech -> text (Sarvam), ask the Ayurveda assistant, then send the spoken
  answer back down the same WebSocket.
"""

import asyncio
import audioop  # on Python 3.13+ this comes from the "audioop-lts" package
import base64
import io
import json
import logging
import struct
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import uvicorn  # noqa: E402
from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.responses import Response  # noqa: E402

from config import (DOMAIN, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,  # noqa: E402
                    TWILIO_PHONE_NUMBER)
from services.ayurveda_rag import assistant  # noqa: E402
from voice.phrases import get_phrase, is_exit_intent  # noqa: E402
from voice.sarvam_voice import init_client, text_to_mp3, translate  # noqa: E402

logging.getLogger("websockets.legacy.protocol").setLevel(logging.CRITICAL)

PORT = 8001                # different from the website API (8000)
SPEECH_RMS = 600           # raise this if background noise triggers replies
SILENCE_MS = 3500          # this much silence after speech = caller finished
MIN_SPEECH_MS = 50         # ignore tiny noise bursts
MAX_AUDIO_BYTES = 8000 * 25  # keep at most the last 25 s of audio

app = FastAPI(title="HealthVeda Phone Line")


# ── Audio conversion (Twilio uses 8 kHz mu-law audio) ────────────────────
def mulaw_to_wav(mulaw: bytes) -> bytes:
    pcm_8k = audioop.ulaw2lin(mulaw, 2)
    pcm_16k, _ = audioop.ratecv(pcm_8k, 2, 1, 8000, 16000, None)
    size = len(pcm_16k)
    header = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + size, b"WAVE", b"fmt ",
                         16, 1, 1, 16000, 32000, 2, 16, b"data", size)
    return header + pcm_16k


def mp3_to_mulaw_chunks(mp3: bytes) -> list[str]:
    from pydub import AudioSegment
    segment = AudioSegment.from_file(io.BytesIO(mp3), format="mp3")
    segment = segment.set_frame_rate(8000).set_channels(1).set_sample_width(2)
    mulaw = audioop.lin2ulaw(segment.raw_data, 2)
    return [base64.b64encode(mulaw[i:i + 160]).decode() for i in range(0, len(mulaw), 160)]


async def say(websocket: WebSocket, stream_sid: str, sarvam, text: str, language: str):
    """Speak `text` to the caller."""
    if not stream_sid:
        return
    try:
        mp3 = await text_to_mp3(sarvam, text, language)
        for chunk in mp3_to_mulaw_chunks(mp3):
            await websocket.send_text(json.dumps(
                {"event": "media", "streamSid": stream_sid, "media": {"payload": chunk}}))
    except WebSocketDisconnect:
        pass
    except Exception as error:
        print(f"⚠️  say() error: {error}")


def twiml(xml_body: str) -> Response:
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><Response>{xml_body}</Response>',
                    media_type="application/xml")


# ── Twilio webhooks ──────────────────────────────────────────────────────
@app.api_route("/answer", methods=["GET", "POST"])
def answer():
    """Call answered. (Twilio trial accounts ask the caller to press a key first.)"""
    return twiml(
        f'<Gather numDigits="1" action="https://{DOMAIN}/connect" method="POST" timeout="30">'
        f'<Say language="en-IN">Connecting you to HealthVeda now.</Say></Gather>'
        f'<Redirect method="POST">https://{DOMAIN}/connect</Redirect>'
    )


@app.api_route("/connect", methods=["GET", "POST"])
def connect():
    """Open a two-way audio stream to /stream."""
    return twiml(f'<Connect><Stream url="wss://{DOMAIN}/stream"/></Connect>')


@app.websocket("/stream")
async def stream(websocket: WebSocket):
    await websocket.accept()
    print("📞 Call connected")

    sarvam = init_client()
    state = {"stream_sid": None, "call_sid": None, "language": "hi-IN",
             "bot_speaking": False, "last_condition": None}
    history: list[dict] = []
    buffer = bytearray()
    has_speech, silent_ms, speech_ms = False, 0, 0

    async def handle_utterance(audio: bytes):
        sid, lang = state["stream_sid"], state["language"]
        try:
            response = await sarvam.speech_to_text.transcribe(
                file=("audio.wav", mulaw_to_wav(audio[-MAX_AUDIO_BYTES:]), "audio/wav"),
                model="saaras:v3", mode="translate", language_code="unknown")
            question = (response.transcript or "").strip()
            lang = state["language"] = response.language_code or "hi-IN"
        except Exception as error:
            print(f"⚠️  Speech-to-text error: {error}")
            return
        if not question:
            return
        print(f"🗣️  [{lang}] {question}")

        state["bot_speaking"] = True
        try:
            if is_exit_intent(question):
                await say(websocket, sid, sarvam, get_phrase("farewell", lang), lang)
                await asyncio.sleep(1.5)
                hang_up(state["call_sid"])
                return

            # Short follow-ups ("what should I eat?") need the last topic
            last = state["last_condition"]
            query = question
            if last and last != "UNKNOWN" and len(question.split()) < 8:
                query = f"regarding {last}: {question}"

            result, _ = await asyncio.gather(
                asyncio.to_thread(assistant.ask, query, list(history), "English", "voice"),
                say(websocket, sid, sarvam, get_phrase("thinking", lang), lang),
            )
            state["last_condition"] = result["condition"]
            print(f"💊 [{result['condition']}] {result['answer'][:80]}...")

            await say(websocket, sid, sarvam, await translate(sarvam, result["answer"], lang), lang)
            await say(websocket, sid, sarvam, get_phrase("followup_prompt", lang), lang)
            await asyncio.sleep(1.0)  # let the caller's phone finish playing
            history.append({"user": question, "bot": result["answer"]})
        finally:
            state["bot_speaking"] = False

    async def greet():
        for _ in range(20):  # wait up to 2 s for Twilio's "start" event
            if state["stream_sid"]:
                break
            await asyncio.sleep(0.1)
        await say(websocket, state["stream_sid"], sarvam, get_phrase("ready", "en-IN"), "en-IN")

    asyncio.create_task(greet())

    try:
        async for raw in websocket.iter_text():
            data = json.loads(raw)
            event = data.get("event")

            if event == "start":
                state["stream_sid"] = data["start"]["streamSid"]
                state["call_sid"] = data["start"].get("callSid")

            elif event == "media":
                if state["bot_speaking"]:          # ignore audio while we talk
                    buffer.clear()
                    has_speech, silent_ms, speech_ms = False, 0, 0
                    continue
                mulaw = base64.b64decode(data["media"]["payload"])
                buffer.extend(mulaw)
                loudness = audioop.rms(audioop.ulaw2lin(mulaw, 2), 2)

                if loudness > SPEECH_RMS:          # caller is talking
                    has_speech, silent_ms = True, 0
                    speech_ms += 20
                elif has_speech:                   # caller paused
                    silent_ms += 20
                    if silent_ms >= SILENCE_MS:
                        if speech_ms >= MIN_SPEECH_MS:
                            asyncio.create_task(handle_utterance(bytes(buffer)))
                        buffer.clear()
                        has_speech, silent_ms, speech_ms = False, 0, 0

            elif event == "stop":
                print("📴 Call ended")
                break
    except WebSocketDisconnect:
        print("📴 Disconnected")


# ── Twilio REST helpers ──────────────────────────────────────────────────
def hang_up(call_sid: str | None):
    if not call_sid:
        return
    from twilio.rest import Client
    Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).calls(call_sid).update(status="completed")
    print(f"📴 Hung up call {call_sid}")


def make_call(to_number: str):
    from twilio.rest import Client
    call = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).calls.create(
        from_=TWILIO_PHONE_NUMBER, to=to_number, url=f"https://{DOMAIN}/answer")
    print(f"📞 Calling {to_number}  (SID: {call.sid})")


if __name__ == "__main__":
    if len(sys.argv) == 2:
        make_call(sys.argv[1])
    else:
        print("Loading knowledge base...")
        assistant.load()
        uvicorn.run(app, host="0.0.0.0", port=PORT)
