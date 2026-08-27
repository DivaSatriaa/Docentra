def build_context(results: list[dict]) -> str:
    sections = []

    for index, result in enumerate(results, start=1):
        sections.append(
            f"""[Source {index}]
Document: {result["document_name"]}
Page: {result["page"]}

{result["text"]}
"""
        )

    return "\n\n".join(sections)
