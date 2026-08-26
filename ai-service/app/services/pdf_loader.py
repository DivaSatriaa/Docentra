from pathlib import Path

from pypdf import PdfReader


def load_pdf(file_path: str) -> list[dict]:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    if path.suffix.lower() != ".pdf":
        raise ValueError("File must be a PDF")

    reader = PdfReader(str(path))

    pages: list[dict] = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        pages.append(
            {
                "page": page_number,
                "text": text.strip(),
            }
        )

    return pages
