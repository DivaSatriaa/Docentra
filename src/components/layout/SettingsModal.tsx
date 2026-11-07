import {
  Cloud,
  Eye,
  EyeOff,
  KeyRound,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

const API_BASE_URL = "http://localhost:8080"

type DeepSeekKeyStatus = {
  configured: boolean
  source: "settings" | "env" | null
  masked_key: string | null
  verified?: boolean
}

type LLMSettings = {
  deepseek: DeepSeekKeyStatus
}

interface SettingsModalProps {
  onClose: () => void
  onSettingsChanged: () => void
}

export default function SettingsModal({
  onClose,
  onSettingsChanged,
}: SettingsModalProps) {
  const [status, setStatus] =
    useState<DeepSeekKeyStatus | null>(null)

  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/settings/llm`,
        )

        if (!response.ok) {
          throw new Error(
            `Failed to load settings: ${response.status}`,
          )
        }

        const data: LLMSettings =
          await response.json()

        setStatus(data.deepseek)
      } catch (requestError) {
        console.error(
          "Failed to load settings:",
          requestError,
        )

        setError("Unable to load settings.")
      }
    }

    void loadSettings()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [isSaving, onClose])

  async function updateKey(
    method: "PUT" | "DELETE",
  ) {
    if (isSaving) {
      return
    }

    setError("")
    setNotice("")
    setIsSaving(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/settings/llm/deepseek-api-key`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body:
            method === "PUT"
              ? JSON.stringify({
                  api_key: apiKey.trim(),
                })
              : undefined,
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ??
            `Request failed with ${response.status}`,
        )
      }

      const settings = data as LLMSettings

      setStatus(settings.deepseek)
      setApiKey("")
      setShowKey(false)

      if (method === "DELETE") {
        setNotice("API key removed.")
      } else if (settings.deepseek.verified === false) {
        setNotice(
          "Saved, but DeepSeek couldn't be reached to verify the key.",
        )
      } else {
        setNotice("API key saved and verified.")
      }

      onSettingsChanged()
    } catch (requestError) {
      console.error(
        "Failed to update API key:",
        requestError,
      )

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update the API key.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (apiKey.trim()) {
      void updateKey("PUT")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSaving
        ) {
          onClose()
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#1c1c20] p-6 shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="mb-5 flex items-start justify-between">
          <h2
            id="settings-title"
            className="text-[15px] font-medium text-white"
          >
            Settings
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {/* DeepSeek API */}
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8E3A59]/[0.12] text-[#C46A8A]">
              <Cloud size={16} strokeWidth={1.8} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white/85">
                DeepSeek API
              </div>

              <div className="text-[11px] text-white/35">
                {status === null
                  ? "Loading..."
                  : status.configured
                    ? `Connected · ${status.masked_key}${
                        status.source === "env"
                          ? " (from .env)"
                          : ""
                      }`
                    : "Not configured"}
              </div>
            </div>

            {status?.configured && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="deepseek-api-key"
              className="mb-1.5 block text-[11px] text-white/45"
            >
              {status?.configured
                ? "Replace API key"
                : "API key"}
            </label>

            <div className="flex items-center gap-2 rounded-lg border border-white/[0.09] bg-[#242428] px-3 focus-within:border-[#8E3A59]/60">
              <KeyRound
                size={14}
                strokeWidth={1.8}
                className="shrink-0 text-white/30"
              />

              <input
                id="deepseek-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) =>
                  setApiKey(event.target.value)
                }
                disabled={isSaving}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] text-white outline-none placeholder:text-white/25 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={
                  showKey ? "Hide API key" : "Show API key"
                }
                className="shrink-0 text-white/30 transition hover:text-white"
              >
                {showKey ? (
                  <EyeOff size={14} strokeWidth={1.8} />
                ) : (
                  <Eye size={14} strokeWidth={1.8} />
                )}
              </button>
            </div>

            <p className="mt-2 text-[10px] leading-4 text-white/30">
              The key is stored by the Docentra AI service on
              this machine and is never shown again in full.
            </p>

            {error && (
              <p className="mt-2 text-[11px] text-red-300/80">
                {error}
              </p>
            )}

            {notice && !error && (
              <p className="mt-2 text-[11px] text-emerald-300/75">
                {notice}
              </p>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              {status?.source === "settings" && (
                <button
                  type="button"
                  onClick={() => void updateKey("DELETE")}
                  disabled={isSaving}
                  className="mr-auto rounded-lg px-3 py-2 text-[12px] font-medium text-red-300/80 transition hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove key
                </button>
              )}

              <button
                type="submit"
                disabled={!apiKey.trim() || isSaving}
                className="rounded-lg bg-[#8E3A59] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#9d4564] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Save key"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
