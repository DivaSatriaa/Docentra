import { Eye, EyeOff, KeyRound, Plus, Server, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  API_PROVIDERS,
  CUSTOM_PRESETS,
  findPreset,
  type ApiProvider,
  type CustomProvider,
} from "../lib/modelSettings"

interface SettingsPageProps {
  keys: Partial<Record<ApiProvider, string>>
  customProviders: CustomProvider[]
  onSetKey: (provider: ApiProvider, key: string) => void
  onSaveCustom: (provider: Omit<CustomProvider, "id">) => void
  onRemoveCustom: (id: string) => void
}

export default function SettingsPage({
  keys,
  customProviders,
  onSetKey,
  onSaveCustom,
  onRemoveCustom,
}: SettingsPageProps) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#18181b] px-8 py-10">
      <div className="mx-auto w-full max-w-[720px]">
        <h1 className="text-xl font-medium text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-white/40">
          Connect an AI provider to use API models. Local models need no key.
        </p>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-medium text-white/80">
            <KeyRound size={15} strokeWidth={1.8} />
            API keys
          </h2>

          <div className="space-y-3">
            {API_PROVIDERS.map((provider) => (
              <KeyRow
                key={provider.id}
                label={provider.label}
                hint={provider.keyHint}
                savedKey={keys[provider.id]}
                onSave={(key) => onSetKey(provider.id, key)}
              />
            ))}
          </div>

          <h2 className="mb-1 mt-9 flex items-center gap-2 text-[13px] font-medium text-white/80">
            <Server size={15} strokeWidth={1.8} />
            Custom providers
          </h2>
          <p className="mb-3 text-[12px] leading-5 text-white/35">
            Type a provider name and paste your key. Known providers
            (DeepSeek, Groq, OpenRouter, Mistral, Together, xAI) are set up
            automatically; for anything else, add its OpenAI-compatible URL.
          </p>

          <div className="space-y-3">
            {customProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <div className="min-w-0">
                  <div className="text-[13px] text-white">{provider.name}</div>
                  <div className="truncate text-[12px] text-white/35">
                    {provider.baseUrl}
                    {provider.apiKey
                      ? ` · ${provider.apiKey.slice(0, 4)}…${provider.apiKey.slice(-4)}`
                      : " · no key"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveCustom(provider.id)}
                  aria-label={`Remove ${provider.name}`}
                  className="shrink-0 rounded p-1.5 text-white/35 transition hover:bg-white/[0.06] hover:text-red-300"
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}

            <CustomProviderForm onSave={onSaveCustom} />
          </div>

          <p className="mt-4 text-[12px] leading-5 text-white/35">
            Keys are stored only in this browser and are sent with your
            requests through the local Docentra backend to the provider you
            choose. They are never saved to the database.
          </p>
        </section>
      </div>
    </main>
  )
}

function KeyRow({
  label,
  hint,
  savedKey,
  onSave,
}: {
  label: string
  hint: string
  savedKey?: string
  onSave: (key: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [visible, setVisible] = useState(false)

  const masked = savedKey ? `${savedKey.slice(0, 4)}…${savedKey.slice(-4)}` : ""

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] text-white">{label}</span>
        {savedKey ? (
          <span className="flex items-center gap-2 text-[12px] text-emerald-300/80">
            Connected · {masked}
            <button
              type="button"
              onClick={() => onSave("")}
              aria-label={`Remove ${label} key`}
              className="rounded p-1 text-white/35 transition hover:bg-white/[0.06] hover:text-red-300"
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </button>
          </span>
        ) : (
          <span className="text-[12px] text-white/30">Not connected</span>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) return
          onSave(draft)
          setDraft("")
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={savedKey ? "Replace key" : hint}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-white/[0.08] bg-[#222226] py-2 pl-3 pr-9 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#8E3A59]/60"
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide key" : "Show key"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-lg bg-[#8E3A59] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#9f4668] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Save
        </button>
      </form>
    </div>
  )
}

function CustomProviderForm({
  onSave,
}: {
  onSave: (provider: Omit<CustomProvider, "id">) => void
}) {
  const [name, setName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [customUrl, setCustomUrl] = useState("")
  const [overrideUrl, setOverrideUrl] = useState(false)
  const [visible, setVisible] = useState(false)

  const preset = findPreset(name)
  // Known name -> its URL, unless the user chose to override it.
  const showUrlField = !preset || overrideUrl
  const baseUrl = showUrlField ? customUrl.trim() : preset.baseUrl
  const urlValid = /^https?:\/\/\S+$/.test(baseUrl)
  const canSave = name.trim() !== "" && urlValid

  const inputClass =
    "w-full rounded-lg border border-white/[0.08] bg-[#222226] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#8E3A59]/60"

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSave) return
        onSave({
          name: preset && !overrideUrl ? preset.name : name.trim(),
          baseUrl: baseUrl.replace(/\/+$/, ""),
          apiKey: apiKey.trim(),
        })
        setName("")
        setApiKey("")
        setCustomUrl("")
        setOverrideUrl(false)
      }}
      className="rounded-xl border border-dashed border-white/[0.12] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-white/40">Quick pick:</span>
        {CUSTOM_PRESETS.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => {
              setName(item.name)
              setOverrideUrl(false)
            }}
            className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[12px] text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Provider name (e.g. DeepSeek)"
          className={inputClass}
        />

        <div className="relative">
          <input
            type={visible ? "text" : "password"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="API key"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} pr-9`}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide key" : "Show key"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {preset && !overrideUrl && (
          <p className="text-[12px] text-white/35">
            Endpoint set automatically: {preset.baseUrl} ·{" "}
            <button
              type="button"
              onClick={() => {
                setOverrideUrl(true)
                setCustomUrl(preset.baseUrl)
              }}
              className="text-white/55 underline-offset-2 hover:text-white hover:underline"
            >
              change
            </button>
          </p>
        )}

        {showUrlField && name.trim() !== "" && (
          <>
            {!preset && (
              <p className="text-[12px] leading-5 text-white/40">
                "{name.trim()}" isn't a known provider, so add its
                OpenAI-compatible base URL.
              </p>
            )}
            <input
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
              placeholder="Base URL (e.g. http://localhost:1234/v1)"
              spellCheck={false}
              className={inputClass}
            />
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSave}
        className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#8E3A59] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#9f4668] disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Plus size={14} strokeWidth={2} />
        Add provider
      </button>
    </form>
  )
}
