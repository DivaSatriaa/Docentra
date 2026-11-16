import {
  FolderOpen,
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
  lazy,
  Suspense,
  useCallback,
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
import type { ViewerSource } from "../viewer/SourceViewer"
import BrandMark from "../ui/BrandMark"
import Sparkle from "../ui/Sparkle"
import { AmbientGlow } from "../ui/Page"
import { useToast } from "../ui/Toast"
import { API_V1 } from "../../lib/api"
import {
  streamMessage,
  type Citation,
  type WebStatus,
} from "../../lib/chatStream"
import { documentCountLabel, type CollectionScope } from "../../lib/collections"
import {
  formatFileSize,
  type WorkspaceDocument,
} from "../../lib/documents"
import {
  toModelPayload,
  type ModelSelection,
  type ModelSettings,
} from "../../lib/modelSettings"

// The viewer pulls in pdf.js, so load it only when a source is opened.
const SourceViewer = lazy(() => import("../viewer/SourceViewer"))

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

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
  scope?: string[]
  /** Only on answers received in this session; not stored. */
  web?: WebStatus
}

function siteName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

type ApiMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  citations?: Citation[] | null
  created_at: string
}

interface MainChatProps {
  conversationId: string
  modelSettings: ModelSettings
  onSelectModel: (selection: ModelSelection) => void
  onOpenSettings: () => void
  onOpenDocuments: () => void
  selectedDocIds: string[]
  onChangeSelectedDocIds: (ids: string[]) => void
  /** Collection the next question is limited to, on top of the ticked documents. */
  selectedCollection: CollectionScope | null
  onChangeSelectedCollection: (scope: CollectionScope | null) => void
  /** Ready documents, newest first. */
  recentDocuments: WorkspaceDocument[]
  onDocumentsChanged: () => void
  /** Called after the chat gets an auto-generated title. */
  onTitleChanged?: () => void
  onMessageCountChange?: (count: number) => void
  /** Called each time a prompt is sent, whatever triggered the send. */
  onPromptSent?: () => void
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
  selectedCollection,
  onChangeSelectedCollection,
  recentDocuments,
  onDocumentsChanged,
  onTitleChanged,
  onMessageCountChange,
  onPromptSent,
}: MainChatProps) {
  const toast = useToast()
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null)
  // Documents and collections already sent with a question in this chat.
  // Their chip above the input is only shown until then; afterwards the scope
  // button in the toolbar stands for them.
  const [sentScopeKeys, setSentScopeKeys] = useState<string[]>([])
  // Also check the documents against the web. Off for every new chat.
  const [webSearch, setWebSearch] = useState(false)
  const [activeSource, setActiveSource] = useState<ViewerSource | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cancel any in-flight answer when the conversation changes or this unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [conversationId])

  const openSource = (citation: Citation, n: number) =>
    setActiveSource({
      key: crypto.randomUUID(),
      source: n,
      document_id: citation.document_id,
      document_name: citation.document_name,
      page: citation.page,
      snippet: citation.snippet,
      highlights: citation.highlights,
    })
  const closeSource = useCallback(() => setActiveSource(null), [])

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
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations ?? undefined,
          }))

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

    const controller = new AbortController()
    abortRef.current = controller
    const userId = crypto.randomUUID()
    // Set on the first delta; keeps the same React key through to "done".
    let assistantId: string | null = null

    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmed },
    ])
    setQuestion("")
    setIsLoading(true)
    setSentScopeKeys((keys) => [
      ...new Set([
        ...keys,
        ...selectedDocIds,
        ...(selectedCollection ? [`collection:${selectedCollection.id}`] : []),
      ]),
    ])
    onMessageCountChange?.(messages.length + 1)
    onPromptSent?.()

    try {
      await streamMessage(
        `${API_V1}/conversations/${conversationId}/messages/stream`,
        {
          content: trimmed,
          model: toModelPayload(modelSettings),
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          collection_id: selectedCollection?.id,
          web_search: webSearch || undefined,
        },
        {
          onDelta: (delta) => {
            if (controller.signal.aborted) return
            if (assistantId === null) {
              const id = crypto.randomUUID()
              assistantId = id
              setMessages((current) => [
                ...current,
                { id, role: "assistant", content: delta },
              ])
              setStreamingId(id)
            } else {
              const id = assistantId
              setMessages((current) =>
                current.map((m) =>
                  m.id === id ? { ...m, content: m.content + delta } : m,
                ),
              )
            }
          },
          onDone: (payload) => {
            if (controller.signal.aborted) return
            if (assistantId === null) {
              const id = crypto.randomUUID()
              assistantId = id
              setMessages((current) => [
                ...current,
                {
                  id,
                  role: "assistant",
                  content: payload.answer,
                  citations: payload.citations,
                  scope: payload.scope,
                  web: payload.web,
                },
              ])
            } else {
              const id = assistantId
              setMessages((current) =>
                current.map((m) =>
                  m.id === id
                    ? {
                        ...m,
                        content: payload.answer,
                        citations: payload.citations,
                        scope: payload.scope,
                        web: payload.web,
                      }
                    : m,
                ),
              )
            }
            setStreamingId(null)
          },
        },
        controller.signal,
      )

      if (controller.signal.aborted) return
      if (isFirstExchange) void renameConversation()
    } catch (requestError) {
      if (controller.signal.aborted) return
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return
      }
      console.error("Failed to send message:", requestError)
      // Take the unanswered question and any partial answer back out so a retry doesn't duplicate it.
      const partialId = assistantId
      setMessages((current) =>
        current.filter((m) => m.id !== userId && m.id !== partialId),
      )

      // The selected collection was deleted or emptied meanwhile: nothing was
      // saved, so hand the question back and drop the stale scope.
      const reason = requestError instanceof Error ? requestError.message : ""
      const collectionGone = reason.includes("collection not found")
      if (collectionGone || reason.includes("collection has no documents")) {
        setQuestion(trimmed)
        onChangeSelectedCollection(null)
        onMessageCountChange?.(messages.length)
        toast(
          collectionGone
            ? "That collection no longer exists. Scope cleared."
            : "That collection is empty. Scope cleared.",
          "error",
        )
        return
      }

      setFailedQuestion(trimmed)
      setError("Docentra AI couldn't answer. Check that the AI service is running.")
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsLoading(false)
        setStreamingId(null)
      }
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

  const waitingLabel = webSearch
    ? "Searching your documents and the web..."
    : selectedCollection
    ? `Reading collection ${selectedCollection.name}${
        selectedDocIds.length > 0
          ? ` + ${documentCountLabel(selectedDocIds.length)}`
          : ""
      }...`
    : selectedDocIds.length > 0
      ? `Reading ${selectedDocIds.length} selected document${selectedDocIds.length > 1 ? "s" : ""}...`
      : "Searching your documents..."

  const composer = (
    <Composer
      inputRef={inputRef}
      question={question}
      setQuestion={setQuestion}
      onSend={() => void sendMessage()}
      isLoading={isLoading}
      disabled={isLoadingHistory}
      hasScope={selectedDocIds.length > 0 || selectedCollection !== null}
      newCollection={
        selectedCollection &&
        !sentScopeKeys.includes(`collection:${selectedCollection.id}`)
          ? selectedCollection
          : null
      }
      onRemoveCollection={() => onChangeSelectedCollection(null)}
      newDocuments={selectedDocIds
        .filter((id) => !sentScopeKeys.includes(id))
        .map(
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
            selectedCollection={selectedCollection}
            onChangeCollection={onChangeSelectedCollection}
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
            disabled={isLoading}
            aria-pressed={webSearch}
            onClick={() => setWebSearch((value) => !value)}
            title={
              webSearch
                ? "Web search is on: your question and short keywords from your documents are sent to DuckDuckGo"
                : "Also check your documents against the web (sends your question and short keywords from your documents to DuckDuckGo)"
            }
            className={[
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40",
              webSearch ? "icon-tile" : "text-white/55",
            ].join(" ")}
          >
            <Globe2 size={14} />
            <span className="hidden md:inline">Web Search</span>
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
    <div className="relative flex min-h-0 min-w-0 flex-1">
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
          isWaiting={isLoading && streamingId === null}
          waitingLabel={waitingLabel}
          composer={composer}
          errorBanner={errorBanner}
          onOpenSource={openSource}
          activeSourceKey={activeSource ? `${activeSource.document_id}:${activeSource.source}` : null}
        />
      ) : (
        <div className="relative z-10 flex flex-1 overflow-y-auto px-4 sm:px-8">
          <div className="mx-auto flex w-full max-w-[860px] flex-col pb-10 pt-[clamp(32px,10vh,110px)]">
            <section className="animate-rise-in text-center">
              <div className="flex items-center justify-center gap-3">
                <Sparkle size={26} className="spark-glow text-spark" />
                <h2 className="font-display text-[30px] font-medium tracking-[-0.02em] text-paper sm:text-[38px]">
                  {greeting()}, <span className="text-brand-gradient">Divas</span>.
                </h2>
              </div>
              <p className="mt-2 text-[15px] text-white/45">
                Ask anything about your documents.
              </p>
            </section>

            <div className="mt-8">{composer}</div>
            {errorBanner && <div className="mt-3">{errorBanner}</div>}

            <section className="mt-9">
              <h3 className="mb-3 text-[12px] font-medium text-white/45">
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
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] surface-card p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand-400/40 hover:bg-brand-500/[0.07] hover:shadow-[0_14px_30px_-18px_rgba(142,58,89,0.9)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg icon-tile transition group-hover:brightness-125">
                      <Icon size={16} />
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
                <h3 className="text-[12px] font-medium text-white/45">Recent documents</h3>
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
                            ? "brand-wash border-brand-400/50"
                            : "surface-card border-white/[0.07] bg-white/[0.02] hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.035]">
                          <FileTypeIcon type={document.extension ?? ""} size={28} />
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
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-plum text-white">
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

    {activeSource && (
      <Suspense fallback={null}>
        <SourceViewer source={activeSource} onClose={closeSource} />
      </Suspense>
    )}
    </div>
  )
}

function ConversationView({
  messages,
  isLoading,
  isWaiting,
  waitingLabel,
  composer,
  errorBanner,
  onOpenSource,
  activeSourceKey,
}: {
  messages: Message[]
  isLoading: boolean
  /** True while a request is in flight and no answer text has arrived yet. */
  isWaiting: boolean
  waitingLabel: string
  composer: ReactNode
  errorBanner: ReactNode
  onOpenSource: (citation: Citation, n: number) => void
  activeSourceKey: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Follow a growing answer, but only if the reader hasn't scrolled away.
  const nearBottomRef = useRef(true)

  // Keep the newest message in view. A message the user just sent always
  // scrolls into view; otherwise only follow when already near the bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (messages[messages.length - 1]?.role === "user") nearBottomRef.current = true
    if (nearBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isLoading])

  const lastContentLength = messages[messages.length - 1]?.content.length ?? 0
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && nearBottomRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" })
  }, [lastContentLength])

  function handleScroll() {
    const el = scrollRef.current
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8">
        <div className="mx-auto w-full max-w-[780px] space-y-7 py-8">
          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} content={message.content} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onOpenSource={onOpenSource}
                activeSourceKey={activeSourceKey}
              />
            ),
          )}

          {isWaiting && (
            <div className="flex animate-rise-in gap-3.5">
              <AssistantAvatar />
              <div className="flex items-center gap-3 pt-1.5 text-[13px] text-white/40">
                <TypingDots />
                {waitingLabel}
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
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-brand-300/20 bg-gradient-to-br from-brand-500/55 via-brand-600/45 to-plum/60 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_24px_-16px_rgba(142,58,89,0.9)] text-[14px] leading-6 text-white sm:max-w-[75%]">
        {content}
      </div>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-ink-800 surface-card">
      <BrandMark size={20} />
    </div>
  )
}

function AssistantMessage({
  message,
  onOpenSource,
  activeSourceKey,
}: {
  message: Message
  onOpenSource: (citation: Citation, n: number) => void
  activeSourceKey: string | null
}) {
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
    const index = citations.findIndex((c, i) => (c.source ?? i + 1) === n)
    if (index !== -1) onOpenSource(citations[index], n)
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

        {message.web && (
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-5 text-white/35">
            <Globe2 size={12} className="mt-1 shrink-0" />
            <span className="min-w-0 break-words">
              {message.web.status === "unavailable"
                ? "Web search was unavailable. Answered from your documents only."
                : message.web.status === "no_results"
                  ? `Nothing relevant found on the web${message.web.query ? ` for: ${message.web.query}` : ""}. Answered from your documents only.`
                  : `Searched the web for: ${message.web.query}`}
              {message.web.requested_url &&
                (message.web.used_url === message.web.requested_url
                  ? ` · Read ${message.web.used_url}`
                  : message.web.used_url
                    ? ` · Couldn't open ${message.web.requested_url}; read ${message.web.used_url} from your documents instead.`
                    : ` · Couldn't open ${message.web.requested_url}.`)}
            </span>
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

              if (citation.kind === "web" && citation.url) {
                return (
                  <a
                    key={`web-${citation.url}-${index}`}
                    id={`${message.id}-src-${n}`}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open this web page in a new tab"
                    className={[
                      "block w-full rounded-xl border px-3 py-2.5 text-left transition duration-300",
                      highlighted === n
                        ? "brand-wash border-brand-400/60"
                        : "surface-card border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-brand-500/20 px-1 text-[10.5px] font-semibold text-brand-300">
                        {n}
                      </span>
                      <Globe2 size={13} className="shrink-0 text-sky-300/80" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/75">
                        {citation.title || siteName(citation.url)}
                      </span>
                      <span className="max-w-[40%] shrink-0 truncate text-[11px] text-white/35">
                        {siteName(citation.url)}
                      </span>
                    </div>
                    {citation.snippet?.trim() && (
                      <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-5 text-white/40">
                        {citation.snippet.trim()}
                      </p>
                    )}
                  </a>
                )
              }

              return (
                <button
                  type="button"
                  key={`${citation.chunk_id}-${index}`}
                  id={`${message.id}-src-${n}`}
                  onClick={() => onOpenSource(citation, n)}
                  title="Show this passage in the document"
                  className={[
                    "w-full rounded-xl border px-3 py-2.5 text-left transition duration-300",
                    highlighted === n ||
                    activeSourceKey === `${citation.document_id}:${n}`
                      ? "brand-wash border-brand-400/60"
                      : "surface-card border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]",
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
                </button>
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
  hasScope,
  newCollection,
  onRemoveCollection,
  newDocuments,
  onRemoveDocument,
  tools,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  question: string
  setQuestion: (value: string) => void
  onSend: () => void
  isLoading: boolean
  disabled: boolean
  /** True when the next question is limited to a collection or documents. */
  hasScope: boolean
  /** Scope items not yet sent with a question; shown as chips above the input. */
  newCollection: CollectionScope | null
  onRemoveCollection: () => void
  newDocuments: (
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
        className="rounded-[20px] border border-white/[0.1] bg-ink-800/90 bg-gradient-to-b from-white/[0.035] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_70px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md transition duration-200 focus-within:border-brand-400/50 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_4px_rgba(142,58,89,0.14),0_24px_70px_-20px_rgba(0,0,0,0.65),0_18px_60px_-24px_rgba(142,58,89,0.55)]"
        onClick={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus()
        }}
      >
        {(newCollection !== null || newDocuments.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {newCollection && (
              <span className="flex max-w-[240px] animate-pop-in items-center gap-1.5 rounded-lg brand-wash border border-brand-400/30 py-1 pl-2 pr-1 text-[12px] text-white/80">
                <FolderOpen size={14} className="shrink-0 text-brand-300" />
                <span className="truncate">{newCollection.name}</span>
                <button
                  type="button"
                  onClick={onRemoveCollection}
                  aria-label={`Remove collection ${newCollection.name}`}
                  className="rounded p-0.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {newDocuments.map((doc) => {
              const name =
                "name" in doc ? doc.name || doc.original_name : doc.label
              return (
                <span
                  key={doc.id}
                  className="flex max-w-[240px] animate-pop-in items-center gap-1.5 rounded-lg brand-wash border border-brand-400/30 py-1 pl-2 pr-1 text-[12px] text-white/80"
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
            hasScope
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl brand-fill active:scale-95"
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
