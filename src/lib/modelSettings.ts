import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL } from "./api"

const STORAGE_KEY = "docentra.modelSettings.v1"

export type ApiProvider = "openai" | "anthropic" | "gemini"

export const API_PROVIDERS: {
  id: ApiProvider
  label: string
  keyHint: string
}[] = [
  { id: "openai", label: "OpenAI", keyHint: "sk-..." },
  { id: "anthropic", label: "Anthropic", keyHint: "sk-ant-..." },
  { id: "gemini", label: "Google Gemini", keyHint: "AIza..." },
]

/** A user-defined OpenAI-compatible endpoint (DeepSeek, Groq, OpenRouter...). */
export type CustomProvider = {
  id: string
  name: string
  baseUrl: string
  apiKey: string
}

/** Known OpenAI-compatible providers: typing one of these names fills the URL. */
export const CUSTOM_PRESETS = [
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { name: "Together", baseUrl: "https://api.together.xyz/v1" },
  { name: "xAI", baseUrl: "https://api.x.ai/v1" },
]

export function findPreset(name: string) {
  const key = name.trim().toLowerCase().replace(/[\s_-]+/g, "")
  if (!key) return undefined
  return CUSTOM_PRESETS.find((p) => p.name.toLowerCase() === key)
}

export type ModelSelection = {
  mode: "local" | "api"
  /** "ollama", a built-in ApiProvider id, or "custom:<id>". */
  provider: string
  model: string
}

export type ModelSettings = {
  keys: Partial<Record<ApiProvider, string>>
  customProviders: CustomProvider[]
  selection: ModelSelection
}

/** Payload sent with each chat message. `null` = backend default model. */
export type ModelPayload = {
  provider: string
  model: string
  api_key?: string
  base_url?: string
} | null

const DEFAULT_SETTINGS: ModelSettings = {
  keys: {},
  customProviders: [],
  selection: { mode: "local", provider: "ollama", model: "" },
}

function load(): ModelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ModelSettings>
    return {
      keys: parsed.keys ?? {},
      customProviders: parsed.customProviders ?? [],
      selection: { ...DEFAULT_SETTINGS.selection, ...parsed.selection },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function save(settings: ModelSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable (private mode etc.) - settings just won't persist.
  }
}

/** Settings state, persisted in this browser's localStorage. */
export function useModelSettings() {
  const [settings, setSettings] = useState<ModelSettings>(load)

  useEffect(() => {
    save(settings)
  }, [settings])

  const setKey = useCallback((provider: ApiProvider, key: string) => {
    setSettings((current) => {
      const keys = { ...current.keys }
      if (key.trim()) keys[provider] = key.trim()
      else delete keys[provider]

      // Removing the key of the provider in use drops the API selection.
      const dropSelection =
        !keys[provider] &&
        current.selection.mode === "api" &&
        current.selection.provider === provider

      return {
        ...current,
        keys,
        selection: dropSelection ? DEFAULT_SETTINGS.selection : current.selection,
      }
    })
  }, [])

  const saveCustomProvider = useCallback(
    (provider: Omit<CustomProvider, "id"> & { id?: string }) => {
      setSettings((current) => {
        const id = provider.id ?? crypto.randomUUID()
        const entry: CustomProvider = { ...provider, id }
        const exists = current.customProviders.some((p) => p.id === id)

        return {
          ...current,
          customProviders: exists
            ? current.customProviders.map((p) => (p.id === id ? entry : p))
            : [...current.customProviders, entry],
        }
      })
    },
    [],
  )

  const removeCustomProvider = useCallback((id: string) => {
    setSettings((current) => ({
      ...current,
      customProviders: current.customProviders.filter((p) => p.id !== id),
      selection:
        current.selection.provider === `custom:${id}`
          ? DEFAULT_SETTINGS.selection
          : current.selection,
    }))
  }, [])

  const setSelection = useCallback((selection: ModelSelection) => {
    setSettings((current) => ({ ...current, selection }))
  }, [])

  return {
    settings,
    setKey,
    setSelection,
    saveCustomProvider,
    removeCustomProvider,
  }
}

export function toModelPayload(settings: ModelSettings): ModelPayload {
  const { mode, provider, model } = settings.selection

  if (!model) return null

  if (mode === "local") return { provider: "ollama", model }

  if (provider.startsWith("custom:")) {
    const custom = settings.customProviders.find(
      (p) => `custom:${p.id}` === provider,
    )
    if (!custom) return null

    return {
      provider: "custom",
      model,
      api_key: custom.apiKey,
      base_url: custom.baseUrl,
    }
  }

  const apiKey = settings.keys[provider as ApiProvider]
  if (!apiKey) return null

  return { provider, model, api_key: apiKey }
}

export async function fetchModels(
  provider: string,
  apiKey?: string,
  baseUrl?: string,
): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      api_key: apiKey ?? "",
      base_url: baseUrl ?? "",
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`)
  }

  return data.models as string[]
}
