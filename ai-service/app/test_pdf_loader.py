from app.services.pdf_loader import load_pdf


pdf_path = "/tmp/test-docentra.pdf"

pages = load_pdf(pdf_path)

print(f"Pages: {len(pages)}")

for page in pages[:3]:
    print(f"\n--- Page {page['page']} ---")
    print(page["text"][:300])
