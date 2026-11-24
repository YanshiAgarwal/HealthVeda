"""
ayurveda_rag.py
---------------
The "brain" of the Veda Assistant chatbot. It uses RAG
(Retrieval-Augmented Generation):

    patient message
        │
        ├─ 1. Safety check  ── emergency? → tell them to go to hospital
        ├─ 2. RETRIEVE      ── search the symptom DB (BM25 keywords + vectors),
        │                      re-rank results, ask the LLM which condition fits
        ├─ 3. RETRIEVE      ── search the Ayurveda book DB for that condition
        └─ 4. GENERATE      ── LLM writes a short, friendly answer using ONLY
                               the retrieved text

Search modes (SEARCH_MODE in .env): "full" (Chroma + re-ranker, needs torch),
"lite" (NumPy index + ONNX embeddings, for Vercel) or "keyword". With "auto" the
best one that loads is used. If no vector mode can load, it falls back to a
simple keyword search over the CSV. If there is no GROQ_API_KEY, it builds the
answer from a template. So the chatbot ALWAYS answers something useful.
"""

import logging
import threading
from difflib import SequenceMatcher

from config import (BOOK_DB_DIR, EMBEDDING_MODEL, RERANKER_MODEL,
                    SEARCH_MODE, SYMPTOM_DB_DIR)
from services import ayurveda_knowledge as kb
from services.llm_service import ask_llm, is_llm_available
from services.safety import EMERGENCY_MESSAGE, is_emergency

logger = logging.getLogger(__name__)

PERSONA = "You are HealthVeda, a kind and knowledgeable Ayurvedic doctor."

CHAT_STYLE = """
Speak like a caring doctor talking to a patient.
Structure: 1) acknowledge the symptom 2) explain the condition simply
3) the Ayurvedic cause (dosha) 4) two or three simple remedies.
Keep it under 120 words. Use plain sentences - no markdown, bullets or symbols.
End with a gentle reminder to see a doctor if symptoms worsen.
"""

VOICE_STYLE = """
Your answer will be converted to speech. Use short natural sentences.
Structure: acknowledge, explain simply, Ayurvedic cause, 2-3 remedies.
Keep it under 80 words. No bullet points or symbols.
End with a gentle reminder to see a doctor if symptoms worsen.
"""

FOLLOW_UP_STYLE = """
Answer the patient's follow-up question conversationally in 2 to 4 short
sentences. Do not repeat the full explanation. No formatting or symbols.
"""

MODE_ORDER = ["full", "lite", "keyword"]


class AyurvedaAssistant:
    """Loads the search indexes once, then answers questions with `ask()`."""

    def __init__(self):
        self._lock = threading.Lock()
        self.mode = "not_loaded"      # -> "full", "lite" or "keyword"
        self.load_error = None
        self._search_symptoms = None  # function(query) -> list of docs
        self._search_book = None

    # ── Loading ───────────────────────────────────────────────────────────
    def load(self):
        """Pick and load the best search mode. Safe to call many times."""
        with self._lock:
            if self.mode != "not_loaded":
                return
            wanted = MODE_ORDER if SEARCH_MODE == "auto" else [SEARCH_MODE, "keyword"]
            for mode in wanted:
                try:
                    if mode == "full":
                        self._load_full()
                    elif mode == "lite":
                        self._load_lite()
                    self.mode = mode
                    logger.info("Ayurveda search mode: %s", mode)
                    return
                except Exception as error:      # missing package / index / model
                    self.load_error = f"{mode}: {error}"
                    logger.info("Search mode '%s' unavailable (%s)", mode, error)

    def _load_full(self):
        """Chroma + BM25 + cross-encoder re-ranker (needs torch)."""
        from langchain_community.embeddings import HuggingFaceEmbeddings
        from langchain_community.retrievers import BM25Retriever
        from langchain_community.vectorstores import Chroma
        from langchain_core.documents import Document
        from sentence_transformers import CrossEncoder

        if not SYMPTOM_DB_DIR.exists():
            raise FileNotFoundError(f"Vector DB not found at {SYMPTOM_DB_DIR}")

        embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL,
                                           encode_kwargs={"normalize_embeddings": True})
        reranker = CrossEncoder(RERANKER_MODEL)

        def build(folder):
            store = Chroma(persist_directory=str(folder), embedding_function=embeddings)
            vectors = store.as_retriever(search_type="mmr", search_kwargs={"k": 6, "fetch_k": 20})
            raw = store.get()
            bm25 = BM25Retriever.from_documents(
                [Document(page_content=t, metadata=m or {}) for t, m in zip(raw["documents"], raw["metadatas"])])
            bm25.k = 6

            def search(query, top_k=4):
                combined, seen = [], set()
                for doc in bm25.invoke(query) + vectors.invoke(query):
                    if doc.page_content not in seen:
                        seen.add(doc.page_content)
                        combined.append(doc)
                if not combined:
                    return []
                scores = reranker.predict([(query, d.page_content) for d in combined])
                ranked = sorted(zip(scores, combined), key=lambda pair: pair[0], reverse=True)
                return [doc for _, doc in ranked[:top_k]]
            return search

        self._search_symptoms = build(SYMPTOM_DB_DIR)
        self._search_book = build(BOOK_DB_DIR) if BOOK_DB_DIR.exists() else None

    def _load_lite(self):
        """Exported NumPy index + ONNX embeddings + BM25 (serverless friendly)."""
        from services.search_lite import Embedder, LiteIndex, lite_index_available

        if not lite_index_available():
            raise FileNotFoundError("vector_index/ not found - run scripts/export_vector_index.py")
        symptoms, book = LiteIndex("symptom"), LiteIndex("book")
        Embedder.embed("warm up")        # load the model now, fail early if missing
        self._search_symptoms = symptoms.search
        self._search_book = book.search

    @property
    def uses_vectors(self) -> bool:
        return self.mode in ("full", "lite")

    def _identify_condition(self, query, history):
        """Step 2: find the most likely condition + the CSV text behind it."""
        search_query = query
        if history:  # follow-ups like "what should I eat?" need the last topic
            search_query = f"{history[-1]['user']} {query}"

        if self.uses_vectors:
            contexts = [d.page_content for d in self._search_symptoms(search_query)]
        else:
            contexts = [kb.profile_to_text(r) for r in kb.keyword_search(search_query)]

        if not contexts:
            return "UNKNOWN", []

        if not is_llm_available():  # no AI key: trust the top search hit
            first_line = contexts[0].splitlines()[0]
            return first_line.split(":", 1)[-1].strip(), contexts

        earlier = "\n".join(f"Patient: {h['user']}" for h in history[-2:])
        prompt = f"""{PERSONA}

Earlier in this conversation:
{earlier or "(nothing yet)"}

Patient message:
{query}

Relevant conditions from the database:
{chr(10).join(c + chr(10) + '---' for c in contexts)}

Identify the single most likely condition based ONLY on the database above.
If this is a follow-up about the same condition, return the same condition name.
If the symptoms are unclear, return UNKNOWN.
Return ONLY the condition name, for example: Common Cold"""
        # (max_tokens leaves room for "thinking" models to reason first)
        answer = ask_llm(prompt, max_tokens=400).strip().strip(".")
        return (answer.splitlines()[0] if answer else "UNKNOWN"), contexts

    def _book_context(self, condition, query):
        """Step 3: extra detail from the Ayurveda book (vector modes only)."""
        if not self.uses_vectors or self._search_book is None or condition == "UNKNOWN":
            return ""
        docs = self._search_book(f"{condition} {query}")

        def similar(a, b):
            return SequenceMatcher(None, a.lower(), b.lower()).ratio() > 0.6

        relevant = [d for d in docs
                    if condition.lower() in d.page_content.lower()
                    or similar(condition, d.metadata.get("disease", ""))]
        return "\n\n".join(d.page_content for d in relevant[:3])

    # ── Main entry point ──────────────────────────────────────────────────
    def ask(self, query: str, history: list | None = None,
            language: str = "English", style: str = "chat",
            report_context: str | None = None) -> dict:
        """
        Answer one patient message.

        history        : previous turns, e.g. [{"user": "...", "bot": "..."}]
        language       : reply language for the web chat ("English", "Hindi", ...)
        style          : "chat" for the website, "voice" for spoken answers
        report_context : findings from the user's latest lab report, so the
                         advice combines symptoms AND report (e.g. avoid sweet
                         remedies for someone with high blood sugar)
        """
        history = history or []

        # 1. Safety first
        if is_emergency(query):
            return {"answer": EMERGENCY_MESSAGE, "condition": "EMERGENCY",
                    "source": "safety", "emergency": True, "profile": None,
                    "mode": self.mode}

        self.load()

        # 2 + 3. Retrieve
        condition, csv_contexts = self._identify_condition(query, history)
        book_context = self._book_context(condition, query)
        profile = kb.get_profile(condition)
        source = "ayurveda book" if book_context else "ayurveda dataset"

        # 4. Generate
        if not is_llm_available():
            answer = (kb.template_answer(profile) if profile else
                      "I could not match your symptoms to a condition in my Ayurvedic "
                      "knowledge base. Please describe them in more detail, or consult a doctor.")
            if report_context:
                answer += (" Your latest lab report also shows some values outside the normal "
                           "range - please keep them in mind and discuss them with your doctor.")
        else:
            # Give the LLM BOTH sources: the dataset entry (herbs, diet, yoga...)
            # and any matching passages from the Ayurveda book.
            dataset_part = kb.profile_to_text(profile) if profile else "\n\n---\n\n".join(csv_contexts[:2])
            reference = f"From the Ayurveda dataset:\n{dataset_part}"
            if book_context:
                reference += f"\n\nFrom the Ayurveda book:\n{book_context}"
            answer = self._generate(query, condition, reference, history, language, style,
                                    report_context)

        return {"answer": answer, "condition": condition, "source": source,
                "emergency": False, "profile": profile, "mode": self.mode,
                "used_report": bool(report_context)}

    def _generate(self, query, condition, reference, history, language, style,
                  report_context=None):
        if history:
            instructions = FOLLOW_UP_STYLE
        else:
            instructions = VOICE_STYLE if style == "voice" else CHAT_STYLE

        past = "\n".join(f"Patient: {h['user']}\nDoctor: {h['bot']}" for h in history[-4:])
        language_rule = "" if language.lower() == "english" else \
            f"Write your whole reply in {language} (use its native script)."
        report_rule = ""
        if report_context:
            report_rule = f"""
The patient's latest lab report findings (from their HealthVeda history):
{report_context}
If any finding is relevant, briefly mention it and adapt the advice to it
(for example, avoid suggesting sugary remedies like honey or jaggery when blood
sugar is high, or salty food when blood pressure is high). Do not diagnose.
"""

        prompt = f"""{PERSONA}
{report_rule}
Previous conversation:
{past or "(none)"}

Patient says:
{query}

Identified condition: {condition}

Reference information:
{reference or "(no reference found)"}

{instructions}
Only use the reference information. If it does not contain the answer,
say you do not have enough Ayurvedic information on that.
{language_rule}"""
        return ask_llm(prompt, max_tokens=900)


# One shared assistant for the whole app (loaded on first question)
assistant = AyurvedaAssistant()
