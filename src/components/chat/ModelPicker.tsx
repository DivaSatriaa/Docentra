import { Check, ChevronDown, Cpu, Cloud, KeyRound, Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  API_PROVIDERS,
  fetchModels,
  type ModelSelection,
  type ModelSettings,
} from "../../lib/modelSettings"

interface ModelPickerProps {
  settings: ModelSettings
  onSelect: (selection: ModelSelection) => void
  onOpenSettings: () => void
  disabled?: boolean
}

export default function ModelPicker({
  settings,
  onSelect,
  onOpenSettings,
  disabled = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(settings.selection.mode)
  const [provider, setProvider] = useState<string>(
    settings.selection.mode === "api" ? settings.selection.provider : "openai",
  )
  // Result is tagged with the request it belongs to, so "loading" is derived
  // (no setState inside the effect body) and stale responses are ignored.
  const [result, setResult] = useState<{
    key: string
    models: string[]
    error: string
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const custom = provider.startsWith("custom:")
    ? settings.customProviders.find((p) => `custom:${p.id}` === provider)
    : undefined
  // A custom provider counts as connected once it exists (its key is optional).
  const apiKey = custom
    ? custom.apiKey
    : settings.keys[provider as keyof typeof settings.keys]
  const providerLabel =
    custom?.name ?? API_PROVIDERS.find((p) => p.id === provider)?.label ?? provider
  const selected = settings.selection

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const needsKey = mode === "api" && !custom && !apiKey
  const requestKey = `${mode === "local" ? "ollama" : provider}|${apiKey ?? ""}|${custom?.baseUrl ?? ""}`
  const current = result?.key === requestKey ? result : null
  const loading = open && !needsKey && !current

  // Load the model list for the visible tab whenever the menu is open.
  useEffect(() => {
    if (!open || needsKey) return

    let cancelled = false

    fetchModels(
      mode === "local" ? "ollama" : custom ? "custom" : provider,
      apiKey,
      custom?.baseUrl,
    )
      .then((models) => {
        if (!cancelled) setResult({ key: requestKey, models, error: "" })
      })
      .catch((err: Error) => {
        if (!cancelled)
          setResult({ key: requestKey, models: [], error: err.message })
      })

    return () => {
      cancelled = true
    }
  }, [open, needsKey, mode, provider, apiKey, custom, requestKey])

  const models = current?.models ?? []
  const error = current?.error ?? ""

  const label = selected.model
    ? selected.model
    : "Default model"

  function choose(model: string) {
    onSelect({
      mode,
      provider: mode === "local" ? "ollama" : provider,
      model,
    })
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 max-w-[200px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-white/55 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
      >
        {selected.mode === "api" && selected.model ? (
          <Cloud size={14} strokeWidth={1.8} className="shrink-0" />
        ) : (
          <Cpu size={14} strokeWidth={1.8} className="shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown size={13} strokeWidth={1.8} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[300px] animate-pop-in rounded-xl border border-white/[0.09] bg-ink-850 p-2 shadow-2xl shadow-black/50">
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
            {(["local", "api"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={[
                  "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] transition",
                  mode === value
                    ? "bg-white/[0.09] text-white"
                    : "text-white/45 hover:text-white",
                ].join(" ")}
              >
                {value === "local" ? (
                  <Cpu size={13} strokeWidth={1.8} />
                ) : (
                  <Cloud size={13} strokeWidth={1.8} />
                )}
                {value === "local" ? "Local" : "API"}
              </button>
            ))}
          </div>

          {mode === "api" && (
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mb-2 w-full rounded-lg border border-white/[0.08] bg-ink-800 px-2.5 py-2 text-[12px] text-white outline-none"
            >
              {API_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              {settings.customProviders.map((item) => (
                <option key={item.id} value={`custom:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </select>
          )}

          <div className="max-h-[260px] overflow-y-auto">
            {mode === "api" && !apiKey ? (
              <div className="px-2 py-4 text-center">
                <p className="mb-3 text-[12px] leading-5 text-white/45">
                  Add your {providerLabel} API key to choose a model, or add
                  your own provider (DeepSeek, Groq, ...).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onOpenSettings()
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-brand-400"
                >
                  <KeyRound size={13} strokeWidth={1.8} />
                  Open Settings
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-white/40">
                <Loader2 size={14} className="animate-spin" />
                Loading models...
              </div>
            ) : error ? (
              <p className="px-2 py-4 text-center text-[12px] leading-5 text-red-300/80">
                {error}
              </p>
            ) : models.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] text-white/40">
                No models found.
              </p>
            ) : (
              models.map((model) => {
                const active =
                  selected.model === model &&
                  selected.mode === mode &&
                  (mode === "local" || selected.provider === provider)

                return (
                  <button
                    key={model}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(model)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="truncate">{model}</span>
                    {active && (
                      <Check size={13} className="shrink-0 text-brand-300" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
