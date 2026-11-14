def build_context(results: list[dict]) -> str:
    """Number each chunk as [S1], [S2], ...

    The "S" keeps source numbers apart from numbers inside the documents
    themselves (table row numbers, list items, years), which small models
    otherwise mistake for citations.
    """
    sections = []

    for index, result in enumerate(results, start=1):
        sections.append(
            f"""[S{index}]
Document: {result["document_name"]}
Page: {result["page"]}

{result["text"]}
"""
        )

    return "\n\n".join(sections)
