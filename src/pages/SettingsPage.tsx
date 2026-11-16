import {
  Coffee,
  Eye,
  EyeOff,
  FileText,
  HardDrive,
  KeyRound,
  MessageSquare,
  PanelLeft,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"

import Button from "../components/ui/Button"
import { ConfirmDialog } from "../components/ui/Dialog"
import { PageContainer, PageHeader } from "../components/ui/Page"
import { useToast } from "../components/ui/Toast"
import { KOFI_URL, removeEach, type Conversation } from "../lib/api"
import {
  deleteDocument,
  fetchDocuments,
  formatFileSize,
  type WorkspaceDocument,
} from "../lib/documents"

import {
  DEFAULT_DISPLAY_NAME,
  MAX_DISPLAY_NAME,
  setDisplayName,
  useDisplayName,
} from "../lib/profile"
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
  autoHideSidebar: boolean
  onSetAutoHideSidebar: (enabled: boolean) => void
  conversations: Conversation[]
  /** Deletes every chat and resolves with how many could not be deleted. */
  onDeleteAllChats: () => Promise<number>
  onDocumentsDeleted: () => void
}

export default function SettingsPage({
  keys,
  customProviders,
  onSetKey,
  onSaveCustom,
  onRemoveCustom,
  autoHideSidebar,
  onSetAutoHideSidebar,
  conversations,
  onDeleteAllChats,
  onDocumentsDeleted,
}: SettingsPageProps) {
  return (
    <PageContainer width="max-w-[760px]">
      <PageHeader
        title="Settings"
        description="Connect AI providers. Local models (Ollama) work without a key."
      />

        <section className="mt-8">
          <SectionTitle
            icon={<PanelLeft size={15} />}
            title="Interface"
            description="How the workspace behaves while you chat."
          />
          <DisplayNameRow />
          <label className="surface-card mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-white/[0.12]">
            <span className="min-w-0">
              <span className="block text-[13px] text-white">Hide sidebar after sending</span>
              <span className="mt-0.5 block text-[12px] leading-5 text-white/40">
                The sidebar slides away when you send a prompt, so the answer gets the
                full width. Bring it back with the button in the top bar or Ctrl/⌘ + B.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={autoHideSidebar}
              onChange={(event) => onSetAutoHideSidebar(event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 shrink-0 rounded-full bg-white/[0.1] transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white/80 after:shadow after:transition-transform after:duration-200 peer-checked:bg-brand-500 peer-checked:after:translate-x-4 peer-checked:after:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300/70"
            />
          </label>
        </section>

      <div className="mt-10 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] surface-card px-4 py-3 text-[12.5px] leading-6 text-white/50">
        <ShieldCheck size={16} className="mt-1 shrink-0 text-emerald-300/80" />
        <p>
          Keys are stored only in this browser and sent with your requests through the
          local Docentra backend to the provider you choose. They are never saved to the
          database.
        </p>
      </div>

        <section className="mt-8">
          <SectionTitle
            icon={<KeyRound size={15} />}
            title="API keys"
            description="Built-in providers for the model picker."
          />

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

        </section>

        <section className="mt-10">
          <SectionTitle
            icon={<Server size={15} />}
            title="Custom providers"
            description="Type a provider name and paste your key. DeepSeek, Groq, OpenRouter, Mistral, Together and xAI are set up automatically; for anything else, add its OpenAI-compatible URL."
          />

          <div className="space-y-3">
            {customProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] surface-card p-4"
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
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <CustomProviderForm onSave={onSaveCustom} />
          </div>
        </section>

        <StorageSection
          conversations={conversations}
          onDeleteAllChats={onDeleteAllChats}
          onDocumentsDeleted={onDocumentsDeleted}
        />

        <section className="mt-10">
          <div className="surface-card flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="min-w-0">
              <div className="text-[13px] text-white">Enjoying Docentra?</div>
              <div className="mt-0.5 text-[12px] leading-5 text-white/40">
                It's free and runs on your machine. A coffee helps keep it going.
              </div>
            </div>
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noreferrer"
              className="brand-fill inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-medium whitespace-nowrap transition duration-150 active:translate-y-px"
            >
              <Coffee size={16} />
              Buy me a coffee
            </a>
          </div>
        </section>
    </PageContainer>
  )
}

function DisplayNameRow() {
  const saved = useDisplayName()
  const [value, setValue] = useState(saved)

  function save() {
    setDisplayName(value)
    // Shows the default again when the field was left empty.
    setValue(value.trim() || DEFAULT_DISPLAY_NAME)
  }

  return (
    <div className="surface-card flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <label htmlFor="display-name" className="min-w-0">
        <span className="block text-[13px] text-white">Your name</span>
        <span className="mt-0.5 block text-[12px] leading-5 text-white/40">
          Shown in the sidebar and the greeting. Saved in this browser only.
        </span>
      </label>
      <input
        id="display-name"
        value={value}
        maxLength={MAX_DISPLAY_NAME}
        placeholder={DEFAULT_DISPLAY_NAME}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="h-9 w-full rounded-xl border border-white/[0.09] bg-ink-900 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-brand-500/60 sm:w-[200px]"
      />
    </div>
  )
}

function StorageSection({
  conversations,
  onDeleteAllChats,
  onDocumentsDeleted,
}: Pick<
  SettingsPageProps,
  "conversations" | "onDeleteAllChats" | "onDocumentsDeleted"
>) {
  const toast = useToast()
  // null while loading, or when the list could not be loaded.
  const [documents, setDocuments] = useState<WorkspaceDocument[] | null>(null)
  const [confirming, setConfirming] = useState<"chats" | "documents" | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDocuments()
      .then((data) => {
        if (!cancelled) setDocuments(data)
      })
      .catch((error) => console.error("Failed to load documents:", error))
    return () => {
      cancelled = true
    }
  }, [])

  const chatCount = conversations.length
  const documentCount = documents?.length ?? 0
  const totalSize = (documents ?? []).reduce((sum, d) => sum + d.file_size, 0)

  async function deleteChats() {
    setBusy(true)
    try {
      const failed = await onDeleteAllChats()
      if (failed === 0) toast("All chats deleted")
      else toast(`${failed} ${failed === 1 ? "chat" : "chats"} could not be deleted.`, "error")
    } catch (error) {
      console.error("Failed to delete chats:", error)
      toast("Failed to delete chats.", "error")
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  async function deleteDocuments() {
    if (!documents) return
    setBusy(true)
    const failed = await removeEach(documents, (d) => deleteDocument(d.id))
    setDocuments(failed)
    onDocumentsDeleted()
    setBusy(false)
    setConfirming(null)
    if (failed.length === 0) toast("All documents deleted")
    else
      toast(
        `${failed.length} ${failed.length === 1 ? "document" : "documents"} could not be deleted.`,
        "error",
      )
  }

  return (
    <section className="mt-10">
      <SectionTitle
        icon={<HardDrive size={15} />}
        title="Storage"
        description="Clear out chats and documents kept on this machine."
      />

      <div className="surface-card divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        <StorageRow
          icon={<MessageSquare size={16} />}
          title="Chats"
          detail={`${chatCount} ${chatCount === 1 ? "chat" : "chats"}`}
          actionLabel="Delete all chats"
          disabled={chatCount === 0}
          onAction={() => setConfirming("chats")}
        />
        <StorageRow
          icon={<FileText size={16} />}
          title="Documents"
          detail={
            documents === null
              ? "Loading..."
              : `${documentCount} ${documentCount === 1 ? "document" : "documents"} · ${formatFileSize(totalSize)}`
          }
          actionLabel="Delete all documents"
          disabled={documentCount === 0}
          onAction={() => setConfirming("documents")}
        />
      </div>

      <ConfirmDialog
        open={confirming === "chats"}
        title="Delete all chats?"
        icon={<Trash2 size={18} />}
        description={
          <>
            All {chatCount} {chatCount === 1 ? "chat" : "chats"} and their messages
            will be permanently deleted. Your documents stay. This can't be undone.
          </>
        }
        confirmLabel="Delete all"
        busy={busy}
        onConfirm={() => void deleteChats()}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "documents"}
        title="Delete all documents?"
        icon={<Trash2 size={18} />}
        description={
          <>
            All {documentCount} {documentCount === 1 ? "document" : "documents"} (
            {formatFileSize(totalSize)}) and their search index will be permanently
            deleted. Your chats stay, but their sources can no longer be opened.
            This can't be undone.
          </>
        }
        confirmLabel="Delete all"
        busy={busy}
        onConfirm={() => void deleteDocuments()}
        onCancel={() => setConfirming(null)}
      />
    </section>
  )
}

function StorageRow({
  icon,
  title,
  detail,
  actionLabel,
  disabled,
  onAction,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  actionLabel: string
  disabled: boolean
  onAction: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl icon-tile">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] text-white">{title}</div>
          <div className="mt-0.5 text-[12px] text-white/40">{detail}</div>
        </div>
      </div>
      <Button size="sm" variant="danger" disabled={disabled} onClick={onAction}>
        <Trash2 size={13} />
        {actionLabel}
      </Button>
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-medium text-white/90">
        <span className="text-brand-300">{icon}</span>
        {title}
      </h2>
      <p className="mt-1 text-[12.5px] leading-5 text-white/40">{description}</p>
    </div>
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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] surface-card p-4">
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
              <Trash2 size={13} />
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
            className="w-full rounded-lg border border-white/[0.08] bg-ink-900 py-2 pl-3 pr-9 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-brand-500/60"
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
          className="rounded-lg brand-fill px-4 py-2 text-[12px] font-medium disabled:cursor-not-allowed"
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
    "w-full rounded-lg border border-white/[0.08] bg-ink-900 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-brand-500/60"

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
        className="mt-3 flex items-center gap-1.5 rounded-lg brand-fill px-4 py-2 text-[12px] font-medium disabled:cursor-not-allowed"
      >
        <Plus size={14} />
        Add provider
      </button>
    </form>
  )
}
