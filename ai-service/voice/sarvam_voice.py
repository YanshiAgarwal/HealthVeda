"""
sarvam_voice.py
---------------
Speech helpers built on Sarvam AI (supports 11 Indian languages).

Pipeline for one spoken question:

  1. listen_and_transcribe()  mic audio  -> English text + detected language
                              (Saaras v3, "translate" mode)
  2. (the Ayurveda assistant answers in English)
  3. translate()              English answer -> user's language
  4. speak()                  text -> audio played on your speakers (Bulbul v3)

Needs SARVAM_API_KEY in backend/.env and ffmpeg installed (for MP3 decoding).
"""

import asyncio
import base64
import io
import struct

import numpy as np

from config import SARVAM_API_KEY

SAMPLE_RATE = 16000
CHUNK_SAMPLES = 1600          # 0.1 second of audio per chunk
SILENCE_RMS = 50              # below this loudness = silence
SILENCE_CHUNKS = 15           # 1.5 s of silence after speech = done talking

# Which Sarvam voice to use for each language
SPEAKERS = {
    "hi-IN": "priya", "bn-IN": "rahul", "ta-IN": "kavitha",
    "te-IN": "shruti", "gu-IN": "neha", "kn-IN": "roopa",
    "ml-IN": "pooja", "mr-IN": "rohan", "pa-IN": "aditya",
    "od-IN": "rahul", "en-IN": "advait", "as-IN": "rahul",
}


def init_client():
    """Create the Sarvam client (raises a clear error if the key is missing)."""
    from sarvamai import AsyncSarvamAI
    if not SARVAM_API_KEY:
        raise EnvironmentError("SARVAM_API_KEY is missing - add it to backend/.env")
    return AsyncSarvamAI(api_subscription_key=SARVAM_API_KEY)


# ── Audio format helpers ─────────────────────────────────────────────────
def pcm_to_wav_bytes(pcm: np.ndarray, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Wrap raw 16-bit PCM samples in a WAV header."""
    pcm = pcm.flatten().astype(np.int16)
    data_size = len(pcm) * 2
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1,
        sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + pcm.tobytes()


def mp3_to_pcm(mp3_bytes: bytes):
    """Decode MP3 (from Sarvam TTS) to raw PCM + sample rate."""
    from pydub import AudioSegment
    segment = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
    segment = segment.set_channels(1).set_sample_width(2)
    return segment.raw_data, segment.frame_rate


# ── 1. Speech -> text ────────────────────────────────────────────────────
async def listen_and_transcribe(client) -> tuple[str, str]:
    """Record from the microphone until the user stops talking.
    Returns (english_text, language_code)."""
    import sounddevice as sd

    print("\n🎙️  Listening...")
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    frames, speech_seen, silent_count = [], False, 0

    def on_audio(indata, frame_count, time_info, status):
        loop.call_soon_threadsafe(queue.put_nowait, indata.copy())

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16",
                        blocksize=CHUNK_SAMPLES, callback=on_audio):
        while True:
            chunk = await queue.get()
            frames.append(chunk)
            loudness = float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2)))
            if loudness > SILENCE_RMS:
                speech_seen, silent_count = True, 0
            elif speech_seen:
                silent_count += 1
                if silent_count >= SILENCE_CHUNKS:
                    break

    audio_b64 = base64.b64encode(pcm_to_wav_bytes(np.concatenate(frames))).decode()

    async with client.speech_to_text_streaming.connect(
        model="saaras:v3", mode="translate", language_code="unknown"
    ) as ws:
        await ws.transcribe(audio=audio_b64, encoding="audio/wav", sample_rate=SAMPLE_RATE)
        async for message in ws:
            if hasattr(message, "data") and message.data.transcript:
                text = message.data.transcript.strip()
                language = message.data.language_code or "hi-IN"
                print(f"📝 You said ({language}): {text}")
                return text, language
    return "", "hi-IN"


# ── 3. Translate ─────────────────────────────────────────────────────────
async def translate(client, text: str, target_language: str) -> str:
    """Translate English text into the user's language."""
    if target_language == "en-IN":
        return text
    response = await client.text.translate(
        input=text,
        source_language_code="en-IN",
        target_language_code=target_language,
        model="sarvam-translate:v1",
    )
    return response.translated_text


# ── 4. Text -> speech ────────────────────────────────────────────────────
async def text_to_mp3(client, text: str, language: str) -> bytes:
    """Convert text to MP3 audio bytes with Sarvam Bulbul v3."""
    mp3 = bytearray()
    async with client.text_to_speech_streaming.connect(
        model="bulbul:v3", send_completion_event="true"
    ) as ws:
        await ws.configure(target_language_code=language,
                           speaker=SPEAKERS.get(language, "advait"))
        await ws.convert(text)
        await ws.flush()
        async for message in ws:
            data = getattr(message, "data", None)
            if data is not None and getattr(data, "audio", None):
                mp3.extend(base64.b64decode(data.audio))
            elif data is not None and getattr(data, "event_type", None) == "final":
                break
    return bytes(mp3)


async def speak(client, text: str, language: str) -> None:
    """Say `text` out loud on this computer's speakers."""
    import sounddevice as sd

    print(f"🔊 Speaking ({language}): {text[:80]}")
    mp3 = await text_to_mp3(client, text, language)
    if not mp3:
        return
    pcm, rate = mp3_to_pcm(mp3)
    sd.play(np.frombuffer(pcm, dtype=np.int16), samplerate=rate)
    sd.wait()
