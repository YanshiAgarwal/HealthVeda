// Voice for the website using the browser's built-in Web Speech API
// (free, no API key). Works best in Google Chrome / Microsoft Edge.
import { useEffect, useRef, useState } from "react";

const Recognition =
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

/** Speech -> text. `listen(lang, onText)` starts the microphone. */
export function useSpeechToText() {
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef(null);

  useEffect(() => () => recognizerRef.current?.abort(), []);

  function listen(lang, onText) {
    if (!Recognition) return;
    const recognizer = new Recognition();
    recognizer.lang = lang;
    recognizer.interimResults = false;
    recognizer.onresult = (event) => onText(event.results[0][0].transcript);
    recognizer.onend = () => setListening(false);
    recognizer.onerror = () => setListening(false);
    recognizerRef.current = recognizer;
    recognizer.start();
    setListening(true);
  }

  function stop() {
    recognizerRef.current?.stop();
    setListening(false);
  }

  return { supported: Boolean(Recognition), listening, listen, stop };
}

/** Text -> speech. Reads `text` aloud in the given language (e.g. "hi-IN"). */
export function speakText(text, lang = "en-IN", onEnd) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === lang);
  if (voice) utterance.voice = voice;
  utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export const stopSpeaking = () => window.speechSynthesis?.cancel();
