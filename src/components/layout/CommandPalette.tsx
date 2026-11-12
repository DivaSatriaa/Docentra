import {
  CornerDownLeft,
  FileText,
  FolderOpen,
  History,
  MessageSquare,
  Plus,
  Search,
  Settings,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import FileTypeIcon from "../common/FileTypeIcon"
import { Kbd } from "../ui/Page"
import {
  conversationTitle,
  formatRelativeTime,
  type Conversation,
} from "../../lib/api"
import type { WorkspaceDocument } from "../../lib/documents"
import type { Page } from "../../lib/navigation"

type Item = {
  id: string
  section: string
  label: string
  hint?: string
  icon: ReactNode
  run: () => void
}

/** Mounted only while open, so its state starts fresh each time. */
export default function CommandPalette({
  onClose,
  conversations,
  documents,
  onNewChat,
  onNavigate,
  onSelectConversation,
  onAskDocument,
}: {
  onClose: () => void
  conversations: Conversation[]
  documents: WorkspaceDocument[]
  onNewChat: () => void
  onNavigate: (page: Page) => void
  onSelectConversation: (id: string) => void
  onAskDocument: (documentId: string) => void
}) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const match = (text: string) => !q || text.toLowerCase().includes(q)

    const actions: Item[] = [
      { id: "new", section: "Actions", label: "New chat", icon: <Plus size={15} />, run: onNewChat },
      { id: "nav-docs", section: "Actions", label: "Go to Documents", icon: <FileText size={15} />, run: () => onNavigate("documents") },
      { id: "nav-coll", section: "Actions", label: "Go to Collections", icon: <FolderOpen size={15} />, run: () => onNavigate("collections") },
      { id: "nav-hist", section: "Actions", label: "Go to History", icon: <History size={15} />, run: () => onNavigate("history") },
      { id: "nav-set", section: "Actions", label: "Open Settings", icon: <Settings size={15} />, run: () => onNavigate("settings") },
    ].filter((item) => match(item.label))

    const chats: Item[] = conversations
      .filter((c) => match(conversationTitle(c)))
      .slice(0, q ? 8 : 5)
      .map((c) => ({
        id: `c-${c.id}`,
        section: "Chats",
        label: conversationTitle(c),
        hint: formatRelativeTime(c.updated_at),
        icon: <MessageSquare size={15} />,
        run: () => onSelectConversation(c.id),
      }))

    const docs: Item[] = documents
      .filter((d) => match(d.name || d.original_name))
      .slice(0, q ? 8 : 4)
      .map((d) => ({
        id: `d-${d.id}`,
        section: "Ask a document",
        label: d.name || d.original_name,
        hint: (d.extension ?? "").toUpperCase(),
        icon: <FileTypeIcon type={d.extension ?? ""} size={16} />,
        run: () => onAskDocument(d.id),
      }))

    return q ? [...chats, ...docs, ...actions] : [...actions, ...chats, ...docs]
  }, [query, conversations, documents, onNewChat, onNavigate, onSelectConversation, onAskDocument])

  const safeIndex = Math.min(activeIndex, Math.max(items.length - 1, 0))

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${safeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [safeIndex])

  function run(item: Item | undefined) {
    if (!item) return
    onClose()
    item.run()
  }

  let lastSection = ""

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-[600px] animate-pop-in overflow-hidden rounded-2xl border border-white/[0.09] bg-ink-850 shadow-2xl shadow-black/60"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose()
          else if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((i) => (items.length ? (Math.min(i, items.length - 1) + 1) % items.length : 0))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((i) => (items.length ? (Math.min(i, items.length - 1) - 1 + items.length) % items.length : 0))
          } else if (event.key === "Enter") {
            event.preventDefault()
            run(items[safeIndex])
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search size={17} className="shrink-0 text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder="Search chats, documents, or actions..."
            className="h-14 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-white/35">
              No results for “{query}”
            </p>
          ) : (
            items.map((item, index) => {
              const header = item.section !== lastSection ? item.section : null
              lastSection = item.section
              const active = index === safeIndex
              return (
                <div key={item.id}>
                  {header && (
                    <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-white/30 first:pt-1">
                      {header}
                    </div>
                  )}
                  <button
                    type="button"
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => run(item)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors",
                      active ? "bg-white/[0.07] text-white" : "text-white/65",
                    ].join(" ")}
                  >
                    <span className={active ? "text-brand-300" : "text-white/40"}>{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-[11px] text-white/30">{item.hint}</span>}
                    {active && <CornerDownLeft size={13} className="shrink-0 text-white/35" />}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-white/30">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
        </div>
      </div>
    </div>
  )
}
