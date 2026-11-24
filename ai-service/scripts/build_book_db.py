"""
Step 3 of 3: build the BOOK vector database from data/Ayurveda.pdf.

The book is split into one section per condition (detected from headings),
each section is cut into ~600-character chunks, and the chunks are stored
in Chroma at vector_db/book_db.

Run from the backend folder:   python scripts/build_book_db.py
(Put the book PDF at backend/data/Ayurveda.pdf first.)
"""

import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from langchain_community.document_loaders import PyPDFLoader  # noqa: E402
from langchain_community.embeddings import HuggingFaceEmbeddings  # noqa: E402
from langchain_community.vectorstores import Chroma  # noqa: E402
from langchain_core.documents import Document  # noqa: E402
from langchain_text_splitters import RecursiveCharacterTextSplitter  # noqa: E402

from config import BOOK_DB_DIR, BOOK_PDF, EMBEDDING_MODEL  # noqa: E402

# Lines that look like headings but are NOT condition names
SKIP_PREFIXES = ("See", "Note", "Chapter", "Appendix", "Part", "The", "This",
                 "If", "For", "In", "A ", "An ", "Illnesses")


def is_heading(lines: list[str], i: int) -> bool:
    """A condition heading is a short, Title-case line with blank lines around it."""
    line = lines[i].strip()
    blank_before = i == 0 or not lines[i - 1].strip()
    blank_after = i == len(lines) - 1 or not lines[i + 1].strip()
    return (bool(line) and blank_before and blank_after
            and line != line.upper()            # skip ALL-CAPS sub-headings
            and line[0].isupper()
            and 3 <= len(line) <= 60
            and not line.startswith(SKIP_PREFIXES))


def split_into_sections(lines: list[str]) -> list[tuple[str, str]]:
    heading_rows = [i for i in range(len(lines)) if is_heading(lines, i)]
    sections = []
    for n, start in enumerate(heading_rows):
        end = heading_rows[n + 1] if n + 1 < len(heading_rows) else len(lines)
        content = "\n".join(l.strip() for l in lines[start:end])
        if len(content) >= 100:                 # skip "see other chapter" stubs
            sections.append((lines[start].strip(), content))
    return sections


def main():
    if not BOOK_PDF.exists():
        sys.exit(f"Book not found: {BOOK_PDF}")

    pages = PyPDFLoader(str(BOOK_PDF)).load()
    lines = "\n".join(p.page_content for p in pages).replace("\t", " ").split("\n")
    sections = split_into_sections(lines)
    print(f"Pages: {len(pages)} | condition sections: {len(sections)}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=80,
                                              separators=["\n\n", "\n", ". ", " "])
    documents = []
    for disease, content in sections:
        chunks = splitter.split_text(content)
        for i, chunk in enumerate(chunks):
            documents.append(Document(
                page_content=f"Disease: {disease}\n\n{chunk}",
                metadata={"disease": disease, "chunk_index": i,
                          "total_chunks": len(chunks), "source": "Ayurvedic Book"},
            ))
    print(f"Chunks: {len(documents)}")

    if BOOK_DB_DIR.exists():
        shutil.rmtree(BOOK_DB_DIR)
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL,
                                       encode_kwargs={"normalize_embeddings": True})
    Chroma.from_documents(documents, embeddings, persist_directory=str(BOOK_DB_DIR))
    print(f"Book DB saved to {BOOK_DB_DIR}")


if __name__ == "__main__":
    main()
