import {
  Check,
  ChevronsUpDown,
  Cloud,
  Cpu,
  RefreshCw,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

const API_BASE_URL = "http://localhost:8080"

export type LLMProviderId = "ollama" | "deepseek"

export type LLMSelection = {
  provider: LLMProviderId
  model: string | null
}

type LLMProvider = {
  id: LLMProviderId
  label: string
  available: boolean
  error: string | null
  default_model: string | null
  models: string[]
}

type ProvidersResponse = {
  providers: LLMProvider[]
}

const providerIcons: Record<LLMProviderId, typeof Cpu> = {
  ollama: Cpu,
  deepseek: Cloud,
}

const providerLabels: Record<LLMProviderId, string> = {
  ollama: "Local LLM",
  deepseek: "DeepSeek API",
}

interface ModelSelectorProps {
  selection: LLMSelection
  onChange: (selection: LLMSelection) => void
}

export default function ModelSelector({
  selection,
  onChange,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const [providers, setProviders] = useState<
    LLMProvider[]
  >([])

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [activeTab, setActiveTab] =
    useState<LLMProviderId>(selection.provider)

  const containerRef = useRef<HTMLDivElement>(null)

  async function loadProviders() {
    setLoadError("")
    setIsLoading(true)

    await fetchProviders()
  }

  // Only sets state after the request resolves, so it
  // is safe to call directly from an effect.
  async function fetchProviders() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/llm/providers`,
      )

      if (!response.ok) {
        throw new Error(
          `Failed to load models: ${response.status}`,
        )
      }

      const data: ProvidersResponse =
        await response.json()

      setProviders(data.providers)
      setLoadError("")
    } catch (error) {
      console.error(
        "Failed to load LLM providers:",
        error,
      )

      setLoadError("Unable to load models.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchProviders()
  }, [])

  // Fill in a model when the saved one is missing or
  // no longer installed.
  useEffect(() => {
    const provider = providers.find(
      (item) => item.id === selection.provider,
    )

    if (
      !provider ||
      !provider.available ||
      (selection.model &&
        provider.models.includes(selection.model))
    ) {
      return
    }

    if (provider.default_model) {
      onChange({
        provider: provider.id,
        model: provider.default_model,
      })
    }
  }, [providers, selection, onChange])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
    )
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
      )
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [isOpen])

  function handleToggle() {
    if (!isOpen) {
      setActiveTab(selection.provider)
      void loadProviders()
    }

    setIsOpen(!isOpen)
  }

  function handleSelectModel(
    provider: LLMProviderId,
    model: string,
  ) {
    onChange({ provider, model })
    setIsOpen(false)
  }

  const SelectedIcon = providerIcons[selection.provider]

  const activeProvider = providers.find(
    (provider) => provider.id === activeTab,
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-left transition hover:border-white/[0.13] hover:bg-white/[0.04]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8E3A59]/[0.12] text-[#C46A8A]">
          <SelectedIcon size={16} strokeWidth={1.8} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-[0.12em] text-white/30">
            {providerLabels[selection.provider]}
          </span>

          <span className="block truncate text-[12px] font-medium text-white/80">
            {selection.model ?? "Select a model"}
          </span>
        </span>

        <ChevronsUpDown
          size={15}
          strokeWidth={1.8}
          className="shrink-0 text-white/35"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-xl border border-white/[0.09] bg-[#1c1c20] p-2 shadow-2xl shadow-black/50">
          {/* Provider tabs */}
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.03] p-1">
            {(["ollama", "deepseek"] as const).map(
              (id) => {
                const Icon = providerIcons[id]
                const active = activeTab === id

                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={[
                      "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                      active
                        ? "bg-[#8E3A59] text-white"
                        : "text-white/45 hover:bg-white/[0.04] hover:text-white",
                    ].join(" ")}
                  >
                    <Icon size={13} strokeWidth={1.8} />
                    {id === "ollama" ? "Local" : "API"}
                  </button>
                )
              },
            )}
          </div>

          <div className="mb-1 flex items-center justify-between px-1.5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/25">
              {activeTab === "ollama"
                ? "Installed models"
                : "Available models"}
            </span>

            <button
              onClick={() => void loadProviders()}
              disabled={isLoading}
              aria-label="Refresh models"
              className="flex h-6 w-6 items-center justify-center rounded-md text-white/30 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            >
              <RefreshCw
                size={12}
                strokeWidth={1.8}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
          </div>

          <div
            role="listbox"
            className="max-h-[220px] overflow-y-auto"
          >
            {loadError ? (
              <div className="px-2 py-2 text-[11px] text-red-300/65">
                {loadError}
              </div>
            ) : !activeProvider ? (
              <div className="px-2 py-2 text-[11px] text-white/25">
                Loading models...
              </div>
            ) : !activeProvider.available ? (
              <div className="px-2 py-2 text-[11px] text-amber-200/60">
                {activeProvider.error ??
                  "This provider is unavailable."}
              </div>
            ) : activeProvider.models.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-white/25">
                No models found.
              </div>
            ) : (
              activeProvider.models.map((model) => {
                const selected =
                  selection.provider ===
                    activeProvider.id &&
                  selection.model === model

                return (
                  <button
                    key={model}
                    role="option"
                    aria-selected={selected}
                    onClick={() =>
                      handleSelectModel(
                        activeProvider.id,
                        model,
                      )
                    }
                    className={[
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] transition",
                      selected
                        ? "bg-white/[0.07] text-white"
                        : "text-white/60 hover:bg-white/[0.04] hover:text-white",
                    ].join(" ")}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {model}
                    </span>

                    {selected && (
                      <Check
                        size={14}
                        strokeWidth={2}
                        className="shrink-0 text-[#C46A8A]"
                      />
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
