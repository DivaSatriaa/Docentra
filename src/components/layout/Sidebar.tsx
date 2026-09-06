import {
  ChevronDown,
  Clock3,
  FileText,
  FolderOpen,
  History,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"

import logo from "../../assets/docentra-logo.png"
import FileTypeIcon from "../common/FileTypeIcon"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

const recentDocuments = [
  { name: "Machine Learning.pdf", type: "pdf" },
  { name: "Sistem Pakar.docx", type: "docx" },
  { name: "Tugas Akhir.pdf", type: "pdf" },
  { name: "Data Mining.pdf", type: "pdf" },
]

type Page =
  | "chat"
  | "documents"
  | "collections"
  | "history"

type Conversation = {
  id: string
  workspace_id: string
  title: string | null
  created_at: string
  updated_at: string
}

interface SidebarProps {
  activePage: Page
  activeConversationId: string
  onNavigate: (page: Page) => void
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onDeleteConversation: (
    deletedId: string,
    replacementId: string | null,
  ) => void
}

export default function Sidebar({
  activePage,
  activeConversationId,
  onNavigate,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
}: SidebarProps) {
  const [conversations, setConversations] = useState<
    Conversation[]
  >([])

  const [
    isLoadingConversations,
    setIsLoadingConversations,
  ] = useState(true)

  const [
    conversationError,
    setConversationError,
  ] = useState("")

  const [deleteTarget, setDeleteTarget] =
    useState<Conversation | null>(null)

  const [isDeletingConversation, setIsDeletingConversation] =
    useState(false)
  

  async function loadConversations() {
    setConversationError("")
    setIsLoadingConversations(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/conversations`,
      )

      if (!response.ok) {
        throw new Error(
          `Failed to load conversations: ${response.status}`,
        )
      }

      const data: Conversation[] =
        await response.json()

      setConversations(
        [...data].sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        ),
      )
    } catch (error) {
      console.error(
        "Failed to load conversations:",
        error,
      )

      setConversationError("Unable to load chats.")
    } finally {
      setIsLoadingConversations(false)
    }
  }

  useEffect(() => {
    void loadConversations()
  }, [])

  useEffect(() => {
    function handleWindowFocus() {
      void loadConversations()
    }

    window.addEventListener(
      "focus",
      handleWindowFocus,
    )

    return () => {
      window.removeEventListener(
        "focus",
        handleWindowFocus,
      )
    }
  }, [])

  async function handleCreateChat() {
    await onNewChat()
    await loadConversations()
  }

  async function handleDeleteConversation(
    id: string,
  ) {
    if (isDeletingConversation) {
      return
    }

    setIsDeletingConversation(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/conversations/${id}`,
        {
          method: "DELETE",
        },
      )

      if (!response.ok) {
        const body = await response.text()

        throw new Error(
          body ||
            `Failed to delete conversation: ${response.status}`,
        )
      }

      const remaining = conversations
        .filter(
          (conversation) =>
            conversation.id !== id,
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        )

      setConversations(remaining)

      const replacementId =
        remaining.length > 0
          ? remaining[0].id
          : null

      setDeleteTarget(null)

      onDeleteConversation(
        id,
        replacementId,
      )
    } catch (error) {
      console.error(
        "Failed to delete conversation:",
        error,
      )

      window.alert(
        "Failed to delete this conversation.",
      )
    } finally {
      setIsDeletingConversation(false)
    }
  }

  return (
    <aside className="relative flex h-screen w-[280px] shrink-0 overflow-hidden border-r border-white/[0.07] bg-[#1d1d20]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(142,58,89,0.08),transparent_38%),radial-gradient(circle_at_20%_85%,rgba(92,31,69,0.10),transparent_40%)]" />

      <div className="relative z-10 flex h-full w-full flex-col">
        {/* Brand */}
        <div className="px-6 pt-6">
          <img
            src={logo}
            alt="Docentra"
            className="w-[195px] max-w-full object-contain object-left"
          />
        </div>

        {/* New chat */}
        <div className="px-5 pt-8">
          <button
            onClick={() => void handleCreateChat()}
            className="flex w-full items-center gap-2 rounded-xl bg-[#8E3A59] px-4 py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(142,58,89,0.18)] transition hover:bg-[#9d4564]"
          >
            <Plus size={18} strokeWidth={2} />
            New Chat
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 pt-4">
          <SidebarItem
            icon={<MessageSquare size={18} />}
            label="Chat"
            active={activePage === "chat"}
            onClick={() => onNavigate("chat")}
          />

          <SidebarItem
            icon={<FileText size={18} />}
            label="Documents"
            active={activePage === "documents"}
            onClick={() =>
              onNavigate("documents")
            }
          />

          <SidebarItem
            icon={<FolderOpen size={18} />}
            label="Collections"
            active={
              activePage === "collections"
            }
            onClick={() =>
              onNavigate("collections")
            }
          />

          <SidebarItem
            icon={<History size={18} />}
            label="History"
            active={activePage === "history"}
            onClick={() =>
              onNavigate("history")
            }
          />
        </nav>

        {/* Conversations */}
        <div className="flex min-h-0 flex-1 flex-col px-5 pt-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/35">
              Recent
            </span>

            <Clock3
              size={13}
              strokeWidth={1.8}
              className="text-white/20"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoadingConversations ? (
              <div className="px-2 py-2 text-[11px] text-white/25">
                Loading chats...
              </div>
            ) : conversationError ? (
              <div className="px-2 py-2 text-[11px] text-red-300/65">
                {conversationError}
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-white/25">
                No conversations yet.
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(
                  (conversation) => {
                    const active =
                      activePage === "chat" &&
                      activeConversationId ===
                        conversation.id

                    return (
                      <div
                        key={conversation.id}
                        className={[
                          "group flex w-full items-center rounded-lg transition",
                          active
                            ? "bg-white/[0.07]"
                            : "hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        {/* Conversation */}
                        <button
                          onClick={() =>
                            onSelectConversation(
                              conversation.id,
                            )
                          }
                          className={[
                            "flex min-w-0 flex-1 items-center gap-2 px-2 py-2.5 text-left",
                            active
                              ? "text-white"
                              : "text-white/60 hover:text-white",
                          ].join(" ")}
                        >
                          <MessageSquare
                            size={15}
                            strokeWidth={1.8}
                            className="shrink-0 text-white/35"
                          />

                          <span className="truncate text-[12px]">
                            {conversation.title?.trim() ||
                              "New Chat"}
                          </span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeleteTarget(conversation)
                          }}
                          aria-label={`Delete ${
                            conversation.title?.trim() ||
                            "New Chat"
                          }`}
                          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/20 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100"
                        >
                          <Trash2
                            size={14}
                            strokeWidth={1.8}
                          />
                        </button>
                      </div>
                    )
                  },
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="px-5 pb-4">
          {/* Recent documents */}
          <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.018] p-2.5">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/25">
              <span>
                Recent Documents
              </span>
            </div>

            <div className="space-y-1">
              {recentDocuments
                .slice(0, 2)
                .map((document) => (
                  <button
                    key={document.name}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-white/[0.04]"
                  >
                    <FileTypeIcon
                      type={document.type}
                      size={17}
                    />

                    <span className="truncate text-[11px] text-white/45">
                      {document.name}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Settings */}
          <button className="mb-4 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white">
            <Settings
              size={17}
              strokeWidth={1.8}
            />
            Settings
          </button>

          {/* User */}
          <div className="border-t border-white/[0.07] pt-3">
            <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.04]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8E3A59] text-sm font-semibold text-white shadow-[0_0_16px_rgba(142,58,89,0.18)]">
                D
              </div>

              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-medium text-white">
                  Diva
                </div>

                <div className="text-[11px] text-white/35">
                  Personal workspace
                </div>
              </div>

              <ChevronDown
                size={15}
                strokeWidth={1.8}
                className="text-white/35"
              />
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#1c1c20] p-6 shadow-2xl shadow-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-conversation-title"
          >
            <div className="mb-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/[0.07]">
                <Trash2
                  size={18}
                  strokeWidth={1.8}
                  className="text-red-300"
                />
              </div>

              <h2
                id="delete-conversation-title"
                className="text-[15px] font-medium text-white"
              >
                Delete conversation?
              </h2>

              <p className="mt-2 text-[13px] leading-6 text-white/50">
                Are you sure you want to delete{" "}
                <span className="font-medium text-white/80">
                  "{deleteTarget.title?.trim() || "New Chat"}"
                </span>
                ?
                <br />
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isDeletingConversation) {
                    return
                  }

                  setDeleteTarget(null)
                }}
                disabled={isDeletingConversation}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleDeleteConversation(
                    deleteTarget.id,
                  )
                }}
                disabled={isDeletingConversation}
                className="rounded-lg bg-red-400/[0.12] px-4 py-2 text-[12px] font-medium text-red-300 transition hover:bg-red-400/[0.18] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeletingConversation
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "mb-1.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
        active
          ? "bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
          : "text-white/55 hover:bg-white/[0.04] hover:text-white",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}