import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, FileHeart, Leaf, Mic, MicOff, Send, Trash2, Volume2, VolumeX } from "lucide-react";

import { sendChatMessage } from "../api/healthveda.js";
import ConditionProfile from "../components/common/ConditionProfile.jsx";
import { CHAT_SUGGESTIONS, LANGUAGES } from "../data/languages.js";
import { speakText, stopSpeaking, useSpeechToText } from "../hooks/useSpeech.js";

const STORAGE_KEY = "healthveda-chat";

function loadSavedChat() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// ── One chat bubble ──────────────────────────────────────────────────────
function Message({ msg, langCode, speakingId, setSpeakingId }) {
  const isUser = msg.role === "user";
  const speaking = speakingId === msg.id;

  function toggleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      setSpeakingId(msg.id);
      speakText(msg.text, langCode, () => setSpeakingId(null));
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf-600 text-white">
          <Leaf size={18} />
        </span>
      )}
      <div className={`max-w-[85%] rounded-3xl px-5 py-3 ${
        isUser ? "rounded-tr-md bg-leaf-600 text-white"
          : msg.emergency ? "rounded-tl-md border-2 border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"
          : "rounded-tl-md bg-white shadow-soft dark:bg-leaf-950"}`}>
        {msg.emergency && (
          <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase"><AlertTriangle size={14} /> Emergency</p>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
        {!isUser && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {msg.condition && !["UNKNOWN", "EMERGENCY"].includes(msg.condition) && (
              <span className="chip bg-leaf-100 text-leaf-700 dark:bg-leaf-900 dark:text-leaf-200">{msg.condition}</span>
            )}
            {msg.reportDate && (
              <span className="chip bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" title="Advice adapted to your latest lab report">
                <FileHeart size={12} /> used your report of {new Date(msg.reportDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
            )}
            {msg.source && msg.source !== "safety" && (
              <span className="chip bg-saffron-50 text-saffron-700 dark:bg-saffron-700/20 dark:text-saffron-300">
                source: {msg.source}
              </span>
            )}
            <button onClick={toggleSpeak} className="ml-auto text-leaf-600 hover:text-leaf-800 dark:text-leaf-300"
              title={speaking ? "Stop" : "Read aloud"}>
              {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-600 text-white"><Leaf size={18} /></span>
      <div className="flex items-center gap-1 rounded-3xl rounded-tl-md bg-white px-5 py-4 shadow-soft dark:bg-leaf-950">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-2 w-2 rounded-full bg-leaf-500"
            animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
        ))}
        <span className="ml-2 text-xs text-slate-400">Consulting the Ayurvedic texts…</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function VedaAssistant() {
  const [messages, setMessages] = useState(loadSavedChat);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [speakingId, setSpeakingId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [useReport, setUseReport] = useState(true); // combine symptoms + latest lab report
  const speech = useSpeechToText();
  const scrollBoxRef = useRef(null);

  // The most recent condition profile, shown in the side panel
  const latestProfile = [...messages].reverse().find((m) => m.profile)?.profile;

  useEffect(() => {
    // Scroll only the message box (not the whole page) to the newest message
    const box = scrollBoxRef.current;
    box?.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
  }, [messages, loading]);

  useEffect(() => () => stopSpeaking(), []);

  async function send(text) {
    const question = text.trim();
    if (!question || loading) return;
    setInput("");

    // History = previous (user, bot) pairs, so follow-up questions make sense
    const history = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === "user" && messages[i + 1].role === "bot") {
        history.push({ user: messages[i].text, bot: messages[i + 1].text });
      }
    }

    setMessages((m) => [...m, { id: Date.now(), role: "user", text: question }]);
    setLoading(true);
    try {
      const reply = await sendChatMessage(question, history.slice(-6), language.name, useReport);
      const botMsg = { id: Date.now() + 1, role: "bot", text: reply.answer, condition: reply.condition,
        source: reply.source, emergency: reply.emergency, profile: reply.profile, reportDate: reply.reportDate };
      setMessages((m) => [...m, botMsg]);
      if (autoSpeak) {
        setSpeakingId(botMsg.id);
        speakText(reply.answer, language.code, () => setSpeakingId(null));
      }
    } catch (error) {
      setMessages((m) => [...m, { id: Date.now() + 1, role: "bot", text: `⚠️ ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function toggleMic() {
    if (speech.listening) return speech.stop();
    speech.listen(language.code, (heard) => send(heard));
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
      {/* ── Chat column ── */}
      <section className="card flex h-[calc(100vh-8rem)] min-h-[520px] flex-col p-0">
        <header className="flex flex-wrap items-center gap-3 border-b border-leaf-100 px-5 py-4 dark:border-leaf-900">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-leaf-500 to-leaf-700 text-white">
            <Bot size={22} />
          </span>
          <div className="mr-auto">
            <h1 className="font-display text-xl font-bold text-leaf-900 dark:text-leaf-50">Veda Assistant</h1>
            <p className="text-xs">Ayurvedic guidance · type or speak</p>
          </div>
          <select value={language.code} onChange={(e) => setLanguage(LANGUAGES.find((l) => l.code === e.target.value))}
            className="input w-auto py-2 text-sm" aria-label="Reply language">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => setUseReport(!useReport)} aria-pressed={useReport}
            title={useReport ? "Using your latest lab report for advice (click to turn off)" : "Not using your lab report (click to turn on)"}
            className={`grid h-10 w-10 place-items-center rounded-full transition ${useReport ? "bg-sky-500 text-white" : "text-leaf-600 hover:bg-leaf-50 dark:hover:bg-leaf-900"}`}>
            <FileHeart size={18} />
          </button>
          <button onClick={() => setAutoSpeak(!autoSpeak)} title="Read every answer aloud"
            className={`grid h-10 w-10 place-items-center rounded-full transition ${autoSpeak ? "bg-saffron-500 text-white" : "text-leaf-600 hover:bg-leaf-50 dark:hover:bg-leaf-900"}`}>
            <Volume2 size={18} />
          </button>
          <button onClick={() => { setMessages([]); stopSpeaking(); }} title="Clear chat"
            className="grid h-10 w-10 place-items-center rounded-full text-leaf-600 hover:bg-leaf-50 dark:hover:bg-leaf-900">
            <Trash2 size={18} />
          </button>
        </header>

        <div ref={scrollBoxRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
          {messages.length === 0 && (
            <div className="grid h-full place-content-center text-center">
              <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 3 }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-leaf-100 text-leaf-600 dark:bg-leaf-900">
                <Leaf size={36} />
              </motion.div>
              <h2 className="mt-4 font-display text-2xl font-bold text-leaf-900 dark:text-leaf-50">Namaste! 🙏</h2>
              <p className="mt-1">How are you feeling today? Try one of these:</p>
              <div className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                {CHAT_SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-full border border-leaf-200 px-4 py-2 text-sm transition hover:border-leaf-500 hover:bg-leaf-50 dark:border-leaf-800 dark:hover:bg-leaf-900">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} msg={m} langCode={language.code} speakingId={speakingId} setSpeakingId={setSpeakingId} />
          ))}
          {loading && <TypingDots />}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 border-t border-leaf-100 p-4 dark:border-leaf-900">
          {speech.supported && (
            <button type="button" onClick={toggleMic} title="Speak"
              className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition ${
                speech.listening ? "bg-red-500 text-white" : "bg-leaf-100 text-leaf-700 hover:bg-leaf-200 dark:bg-leaf-900 dark:text-leaf-200"}`}>
              {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60" />}
              {speech.listening ? <MicOff size={20} className="relative" /> : <Mic size={20} />}
            </button>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)} className="input"
            placeholder={speech.listening ? "Listening… speak now" : `Describe your symptoms (${language.name})…`} />
          <button type="submit" disabled={!input.trim() || loading} className="btn-primary h-12 w-12 shrink-0 p-0">
            <Send size={18} />
          </button>
        </form>
      </section>

      {/* ── Side panel: Ayurvedic profile of the detected condition ── */}
      <aside className="card h-fit lg:sticky lg:top-24">
        <AnimatePresence mode="wait">
          {latestProfile ? (
            <motion.div key={latestProfile.disease} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ConditionProfile profile={latestProfile} />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <Leaf className="mx-auto text-leaf-300" size={40} />
              <h3 className="mt-3 font-display text-lg font-bold text-leaf-900 dark:text-leaf-50">Ayurvedic profile</h3>
              <p className="mt-1 text-sm">
                Once I understand your symptoms, herbs, diet, yoga and prevention tips for that
                condition will appear here.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
}
