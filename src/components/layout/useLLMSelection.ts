import { useEffect, useState } from "react"

import type { LLMSelection } from "./ModelSelector"

const STORAGE_KEY = "docentra.llmSelection"

const DEFAULT_SELECTION: LLMSelection = {
  provider: "ollama",
  model: null,
}

function loadSelection(): LLMSelection {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return DEFAULT_SELECTION
    }

    const parsed = JSON.parse(saved)

    if (
      parsed.provider === "ollama" ||
      parsed.provider === "deepseek"
    ) {
      return {
        provider: parsed.provider,
        model:
          typeof parsed.model === "string"
            ? parsed.model
            : null,
      }
    }
  } catch {
    // Fall back to the default selection.
  }

  return DEFAULT_SELECTION
}

export default function useLLMSelection() {
  const [selection, setSelection] =
    useState<LLMSelection>(loadSelection)

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(selection),
      )
    } catch {
      // Storage may be unavailable; the selection still works in memory.
    }
  }, [selection])

  return [selection, setSelection] as const
}
