"""Turn an uploaded file into pages of plain text.

Every loader returns [{"page": int, "text": str}, ...]. Formats without real
pages use one page per logical unit (sheet, slide) or a single page.
"""

import csv
from pathlib import Path

from app.services.pdf_loader import load_pdf


def _read_text(path: Path) -> str:
    data = path.read_bytes()

    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue

    return data.decode("utf-8", errors="replace")


def _load_text(path: Path) -> list[dict]:
    return [{"page": 1, "text": _read_text(path).strip()}]


def _row_text(headers: list[str], row: list) -> str:
    cells = []

    for index, value in enumerate(row):
        if value is None or str(value).strip() == "":
            continue
        header = headers[index] if index < len(headers) and headers[index] else ""
        cells.append(f"{header}: {value}" if header else str(value))

    return "; ".join(cells)


def _load_csv(path: Path) -> list[dict]:
    text = _read_text(path)

    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    rows = list(csv.reader(text.splitlines(), dialect))

    if not rows:
        return [{"page": 1, "text": ""}]

    headers = [cell.strip() for cell in rows[0]]
    lines = [_row_text(headers, row) for row in rows[1:]] or [", ".join(headers)]

    # One row per line and a full stop, so the chunker splits between rows.
    return [{"page": 1, "text": "\n".join(f"{line}." for line in lines if line)}]


def _load_docx(path: Path) -> list[dict]:
    from docx import Document

    document = Document(str(path))
    parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]

    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(dict.fromkeys(cells)) + ".")

    return [{"page": 1, "text": "\n".join(parts)}]


def _load_xlsx(path: Path) -> list[dict]:
    from openpyxl import load_workbook

    workbook = load_workbook(str(path), read_only=True, data_only=True)
    pages = []

    try:
        for number, sheet in enumerate(workbook.worksheets, start=1):
            rows = [list(row) for row in sheet.iter_rows(values_only=True)]
            rows = [row for row in rows if any(cell is not None for cell in row)]

            if not rows:
                continue

            headers = ["" if cell is None else str(cell).strip() for cell in rows[0]]
            lines = [_row_text(headers, row) for row in rows[1:]] or [", ".join(headers)]
            body = "\n".join(f"{line}." for line in lines if line)

            pages.append({"page": number, "text": f"Sheet {sheet.title}.\n{body}"})
    finally:
        workbook.close()

    return pages or [{"page": 1, "text": ""}]


def _load_pptx(path: Path) -> list[dict]:
    from pptx import Presentation

    pages = []

    for number, slide in enumerate(Presentation(str(path)).slides, start=1):
        parts = []

        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    parts.append(text)

        pages.append({"page": number, "text": "\n".join(parts)})

    return pages or [{"page": 1, "text": ""}]


_LOADERS = {
    ".pdf": load_pdf,
    ".txt": _load_text,
    ".md": _load_text,
    ".csv": _load_csv,
    ".docx": _load_docx,
    ".xlsx": _load_xlsx,
    ".pptx": _load_pptx,
}


def load_document(file_path: str) -> list[dict]:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            "The uploaded file is missing on the server. Please upload it again."
        )

    extension = path.suffix.lower()

    if extension == ".doc":
        raise ValueError(
            "Old Word files (.doc) aren't supported. Save it as .docx and upload again."
        )

    loader = _LOADERS.get(extension)

    if loader is None:
        raise ValueError(f"Unsupported file type: {extension or 'unknown'}")

    return loader(path) if loader is not load_pdf else load_pdf(str(path))
