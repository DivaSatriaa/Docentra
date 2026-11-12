import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileText,
  GitCompareArrows,
  Globe2,
  Lightbulb,
  RotateCcw,
  ScanSearch,
  X,
} from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import FileTypeIcon from "../common/FileTypeIcon"
import ModelPicker from "../chat/ModelPicker"
import DocumentScopePicker from "../chat/DocumentScopePicker"
import UploadButton from "../chat/UploadButton"
import BrandMark from "../ui/BrandMark"
import Sparkle from "../ui/Sparkle"
import { AmbientGlow } from "../ui/Page"
import { useToast } from "../ui/Toast"
import { API_V1 } from "../../lib/api"
import {
  formatFileSize,
  type WorkspaceDocument,
} from "../../lib/documents"
import {
  toModelPayload,
  type ModelSelection,
  type ModelSettings,
} from "../../lib/modelSettings"

const PROMPTS = [
  {
    icon: FileText,
    label: "Summarize",
    subtitle: "this document",
    text: "Summarize this document in a few key points.",
  },
  {
    icon: Lightbulb,
    label: "Explain key",
    subtitle: "concepts",
    text: "Explain the key concepts in simple terms.",
  },
  {
    icon: GitCompareArrows,
    label: "Compare",
    subtitle: "these files",
    text: "Compare these files: what do they agree and disagree on?",
  },
  {
    icon: ScanSearch,
    label: "Find important",
    subtitle: "data",
    text: "Find the most important data, numbers and dates.",
  },
]

type Citation = {
  source?: number
  document_id: string
  document_name: string
  page: number
  chunk_id: string
  snippet: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  scope?: string[]
}

type ApiMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
}

type ApiResponse = {
  scope?: string[]
  answer: string
  search_query: string
  citations: Citation[]
}

interface MainChatProps {
  conversationId: string
  modelSettings: ModelSettings
  onSelectModel: (selection: ModelSelection) => void
  onOpenSettings: () => void
  onOpenDocuments: () => void
  selectedDocIds: string[]
  onChangeSelectedDocIds: (ids: string[]) => void
  /** Ready documents, newest first. */
  recentDocuments: WorkspaceDocument[]
  onDocumentsChanged: () => void
  /** Called after the chat gets an auto-generated title. */
  onTitleChanged?: () => void
  onMessageCountChange?: (count: number) => void
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return "Working late"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function MainChat({
  conversationId,
  modelSettings,
  onSelectModel,
  onOpenSettings,
  onOpenDocuments,
  selectedDocIds,
  onChangeSelectedDocIds,
  recentDocuments,
  onDocumentsChanged,
  onTitleChanged,
  onMessageCountChange,
}: MainChatProps) {
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // The parent remounts this component per conversation, so this runs once per chat.
  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const response = await fetch(
          `${API_V1}/conversations/${conversationId}/messages`,
        )
        if (!response.ok) {
          throw new Error(`Failed to load messages: ${response.status}`)
        }
        const data: ApiMessage[] = await response.json()
        if (cancelled) return

        const loaded: Message[] = data
          .filter(
            (m): m is ApiMessage & { role: "user" | "assistant" } =>
              m.role === "user" || m.role === "assistant",
          )
          .map((m) => ({ id: m.id, role: m.role, content: m.content }))

        setMessages(loaded)
        onMessageCountChange?.(loaded.length)
      } catch (requestError) {
        console.error("Failed to load conversation:", requestError)
        if (!cancelled) {
          setError("Something went wrong while loading this conversation.")
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false)
      }
    }

    void loadHistory()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  async function sendMessage(text = question) {
    const trimmed = text.trim()
    if (!trimmed || isLoading || isLoadingHistory) return

    setError("")
    setFailedQuestion(null)
    const isFirstExchange = messages.length === 0

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ])
    setQuestion("")
    setIsLoading(true)
    onMessageCountChange?.(messages.length + 1)

    try {
      const response = await fetch(
        `${API_V1}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: trimmed,
            model: toModelPayload(modelSettings),
            document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          }),
        },
      )

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || `Request failed with ${response.status}`)
      }

      const data: ApiResponse = await response.json()

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          scope: data.scope,
        },
      ])

      if (isFirstExchange) void renameConversation()
    } catch (requestError) {
      console.error("Failed to send message:", requestError)
      // Take the unanswered question back out so a retry doesn't duplicate it.
      setMessages((current) => current.slice(0, -1))
      setFailedQuestion(trimmed)
      setError("Docentra AI couldn't answer. Check that the AI service is running.")
    } finally {
      setIsLoading(false)
    }
  }

  async function renameConversation() {
    try {
      const response = await fetch(
        `${API_V1}/conversations/${conversationId}/title`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: toModelPayload(modelSettings) }),
        },
      )
      if (response.ok) onTitleChanged?.()
    } catch (renameError) {
      // The default title is fine if this fails.
      console.error("Failed to name conversation:", renameError)
    }
  }

  function toggleDocument(documentId: string) {
    onChangeSelectedDocIds(
      selectedDocIds.includes(documentId)
        ? selectedDocIds.filter((id) => id !== documentId)
        : [...selectedDocIds, documentId],
    )
  }

  const composer = (
    <Composer
      inputRef={inputRef}
      question={question}
      setQuestion={setQuestion}
      onSend={() => void sendMessage()}
      isLoading={isLoading}
      disabled={isLoadingHistory}
      selectedDocuments={selectedDocIds.map(
        (id) =>
          recentDocuments.find((d) => d.id === id) ?? {
            id,
            label: "Document",
            extension: "",
          },
      )}
      onRemoveDocument={toggleDocument}
      tools={
        <>
          <UploadButton
            disabled={isLoading}
            onReady={(documentId) => {
              if (!selectedDocIds.includes(documentId)) {
                onChangeSelectedDocIds([...selectedDocIds, documentId])
              }
              onDocumentsChanged()
            }}
          />
          <DocumentScopePicker
            selectedIds={selectedDocIds}
            onChange={onChangeSelectedDocIds}
            disabled={isLoading}
          />
          <ModelPicker
            settings={modelSettings}
            onSelect={onSelectModel}
            onOpenSettings={onOpenSettings}
            disabled={isLoading}
          />
          <button
            type="button"
            disabled
            title="Web search is coming soon"
            className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-white/30 md:flex"
          >
            <Globe2 size={14} strokeWidth={1.8} />
            Web Search
            <span className="rounded bg-white/[0.06] px-1 py-px text-[9.5px] font-medium uppercase tracking-wide text-white/35">
              Soon
            </span>
          </button>
        </>
      }
    />
  )

  const errorBanner = error && (
    <div
      role="alert"
      className="flex animate-rise-in items-center gap-3 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-200/85"
    >
      <AlertCircle size={16} className="shrink-0" />
      <span className="flex-1">{error}</span>
      {failedQuestion && (
        <button
          type="button"
          onClick={() => void sendMessage(failedQuestion)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium text-red-100 transition hover:bg-red-400/10"
        >
          <RotateCcw size={13} />
          Retry
        </button>
      )}
    </div>
  )

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <AmbientGlow />

      {isLoadingHistory ? (
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-[13px] text-white/40">
            <TypingDots />
            Loading conversation
          </div>
        </div>
      ) : messages.length > 0 || isLoading ? (
        <ConversationView
          messages={messages}
          isLoading={isLoading}
          scopeCount={selectedDocIds.length}
          composer={composer}
          errorBanner={errorBanner}
        />
      ) : (
        <div className="relative z-10 flex flex-1 overflow-y-auto px-4 sm:px-8">
          <div className="mx-auto flex w-full max-w-[860px] flex-col pb-10 pt-[clamp(32px,10vh,110px)]">
            <section className="animate-rise-in text-center">
              <div className="flex items-center justify-center gap-3">
                <Sparkle size={26} className="spark-glow text-spark" />
                <h2 className="font-display text-[30px] font-medium tracking-[-0.02em] text-paper sm:text-[38px]">
                  {greeting()}, Divas.
                </h2>
              </div>
              <p className="mt-2 text-[15px] text-white/45">
                Ask anything about your documents.
              </p>
            </section>

            <div className="mt-8">{composer}</div>
            {errorBanner && <div className="mt-3">{errorBanner}</div>}

            <section className="mt-9">
              <h3 className="mb-3 text-[13px] font-medium text-white/60">
                Suggested prompts
              </h3>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {PROMPTS.map(({ icon: Icon, label, subtitle, text }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setQuestion(text)
                      inputRef.current?.focus()
                    }}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition duration-200 hover:-translate-y-px hover:border-brand-500/40 hover:bg-brand-500/[0.06]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/[0.12] text-brand-300 transition group-hover:bg-brand-500/25">
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 text-[12.5px] leading-[17px]">
                      <span className="block font-medium text-white/85">{label}</span>
                      <span className="block text-white/40">{subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-9">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-medium text-white/60">Recent documents</h3>
                <button
                  type="button"
                  onClick={onOpenDocuments}
                  className="text-[12px] text-white/35 transition hover:text-white/75"
                >
                  View all
                </button>
              </div>

              {recentDocuments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/[0.09] px-4 py-6 text-center text-[13px] text-white/35">
                  No documents yet. Use <span className="text-white/60">Upload</span> in the
                  box above to add your first one.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {recentDocuments.slice(0, 3).map((document) => {
                    const active = selectedDocIds.includes(document.id)
                    return (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => toggleDocument(document.id)}
                        aria-pressed={active}
                        title={active ? "Remove from question scope" : "Ask about this document"}
                        className={[
                          "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition duration-200",
                          active
                            ? "border-brand-500/60 bg-brand-500/[0.08]"
                            : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                          <FileTypeIcon type={document.extension ?? ""} size={26} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-white/85">
                            {document.name || document.original_name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-white/35">
                            {formatFileSize(document.file_size)} ·{" "}
                            {(document.extension ?? "").toUpperCase()}
                          </span>
                        </span>
                        {active && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                            <Check size={12} strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  )
}

function ConversationView({
  messages,
  isLoading,
  scopeCount,
  composer,
  errorBanner,
}: {
  messages: Message[]
  isLoading: boolean
  scopeCount: number
  composer: ReactNode
  errorBanner: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages.length, isLoading])

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8">
        <div className="mx-auto w-full max-w-[780px] space-y-7 py-8">
          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AssistantMessage key={message.id} message={message} />
            ),
          )}

          {isLoading && (
            <div className="flex animate-rise-in gap-3.5">
              <AssistantAvatar />
              <div className="flex items-center gap-3 pt-1.5 text-[13px] text-white/40">
                <TypingDots />
                {scopeCount > 0
                  ? `Reading ${scopeCount} selected document${scopeCount > 1 ? "s" : ""}...`
                  : "Searching your documents..."}
              </div>
            </div>
          )}

          {errorBanner}
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-8 sm:pb-5">
        <div className="mx-auto w-full max-w-[780px]">{composer}</div>
      </div>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex animate-rise-in justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-brand-500/30 bg-gradient-to-br from-brand-500/45 to-plum/50 px-4 py-2.5 text-[14px] leading-6 text-white sm:max-w-[75%]">
        {content}
      </div>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-ink-800">
      <BrandMark size={20} />
    </div>
  )
}

function AssistantMessage({ message }: { message: Message }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const [showSources, setShowSources] = useState(false)
  const citations = message.citations ?? []

  // Turn "[1]" markers into links the renderer shows as citation chips.
  const content =
    citations.length > 0
      ? message.content.replace(/\[(\d{1,2})\](?!\()/g, "[$1](#cite-$1)")
      : message.content

  function focusCitation(n: number) {
    setShowSources(true)
    setHighlighted(n)
    window.setTimeout(() => setHighlighted(null), 1600)
    requestAnimationFrame(() =>
      document
        .getElementById(`${message.id}-src-${n}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast("Couldn't copy to clipboard", "error")
    }
  }

  return (
    <div className="group flex animate-rise-in gap-3.5">
      <AssistantAvatar />

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="prose-chat">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a({ href, children }) {
                const match = href?.match(/^#cite-(\d+)$/)
                if (match) {
                  const n = Number(match[1])
                  return (
                    <button
                      type="button"
                      className="cite"
                      onClick={() => focusCitation(n)}
                      title="Show source"
                    >
                      {n}
                    </button>
                  )
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {message.scope && message.scope.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-white/35">
            <FileText size={12} />
            Searched only in: {message.scope.join(", ")}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {citations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSources((v) => !v)}
              aria-expanded={showSources}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 text-[11.5px] text-white/55 transition hover:border-white/[0.14] hover:text-white"
            >
              <FileText size={12.5} />
              {citations.length} source{citations.length > 1 ? "s" : ""}
              <ChevronDown
                size={12.5}
                className={`transition ${showSources ? "rotate-180" : ""}`}
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copy answer"
            title="Copy answer"
            className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11.5px] text-white/35 opacity-100 transition hover:bg-white/[0.05] hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {showSources && citations.length > 0 && (
          <div className="mt-2.5 grid animate-rise-in gap-2 sm:grid-cols-2">
            {citations.map((citation, index) => {
              const n = citation.source ?? index + 1
              return (
                <div
                  key={`${citation.chunk_id}-${index}`}
                  id={`${message.id}-src-${n}`}
                  className={[
                    "rounded-xl border px-3 py-2.5 transition duration-300",
                    highlighted === n
                      ? "border-brand-400/70 bg-brand-500/[0.12]"
                      : "border-white/[0.07] bg-white/[0.02]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-brand-500/20 px-1 text-[10.5px] font-semibold text-brand-300">
                      {n}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/75">
                      {citation.document_name}
                    </span>
                    <span className="shrink-0 text-[11px] text-white/35">p. {citation.page}</span>
                  </div>
                  {citation.snippet?.trim() && (
                    <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-5 text-white/40">
                      {citation.snippet.trim()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  )
}

function Composer({
  inputRef,
  question,
  setQuestion,
  onSend,
  isLoading,
  disabled,
  selectedDocuments,
  onRemoveDocument,
  tools,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  question: string
  setQuestion: (value: string) => void
  onSend: () => void
  isLoading: boolean
  disabled: boolean
  selectedDocuments: (
    | WorkspaceDocument
    | { id: string; label: string; extension: string }
  )[]
  onRemoveDocument: (id: string) => void
  tools: ReactNode
}) {
  // Grow with the text, up to a limit.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [question, inputRef])

  const canSend = question.trim() !== "" && !isLoading && !disabled

  return (
    <div>
      <section
        className="rounded-[20px] border border-white/[0.1] bg-ink-800/90 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md transition focus-within:border-brand-500/45 focus-within:shadow-[0_0_0_4px_rgba(142,58,89,0.12),0_24px_70px_-20px_rgba(0,0,0,0.6)]"
        onClick={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus()
        }}
      >
        {selectedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {selectedDocuments.map((doc) => {
              const name =
                "name" in doc ? doc.name || doc.original_name : doc.label
              return (
                <span
                  key={doc.id}
                  className="flex max-w-[240px] animate-pop-in items-center gap-1.5 rounded-lg border border-brand-500/35 bg-brand-500/[0.1] py-1 pl-2 pr-1 text-[12px] text-white/80"
                >
                  <FileTypeIcon type={doc.extension ?? ""} size={14} />
                  <span className="truncate">{name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveDocument(doc.id)}
                    aria-label={`Remove ${name}`}
                    className="rounded p-0.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        <textarea
          id="composer-input"
          ref={inputRef}
          value={question}
          rows={2}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (canSend) onSend()
            }
          }}
          disabled={disabled}
          placeholder={
            selectedDocuments.length > 0
              ? "Ask about the selected documents..."
              : "Ask about your documents..."
          }
          className="block max-h-[220px] min-h-[56px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[14.5px] leading-6 text-white outline-none placeholder:text-white/30 disabled:opacity-60"
        />

        <div className="flex items-end justify-between gap-2 p-2.5 pt-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1">{tools}</div>

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            title="Send (Enter)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-[0_8px_20px_-6px_rgba(142,58,89,0.7)] transition hover:bg-brand-400 active:scale-95 disabled:bg-white/[0.07] disabled:text-white/30 disabled:shadow-none"
          >
            <ArrowUp size={18} strokeWidth={2.2} />
          </button>
        </div>
      </section>

      <p className="mt-2 hidden text-center text-[11px] text-white/25 sm:block">
        <span className="text-white/40">Enter</span> to send ·{" "}
        <span className="text-white/40">Shift + Enter</span> for a new line · Answers can
        be wrong, so check the sources.
      </p>
    </div>
  )
}
