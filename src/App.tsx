import { Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import Sidebar from "./components/layout/Sidebar"
import TopBar from "./components/layout/TopBar"
import CommandPalette from "./components/layout/CommandPalette"
import MainChat from "./components/layout/MainChat"
import DocumentsPage from "./pages/DocumentsPage"
import CollectionsPage from "./pages/CollectionsPage"
import HistoryPage from "./pages/HistoryPage"
import SettingsPage from "./pages/SettingsPage"
import { ConfirmDialog } from "./components/ui/Dialog"
import { useToast } from "./components/ui/Toast"
import BrandMark from "./components/ui/BrandMark"
import { useModelSettings } from "./lib/modelSettings"
import { useRecentDocuments } from "./lib/documents"
import { documentCountLabel, type CollectionScope } from "./lib/collections"
import {
  conversationTitle,
  createConversation,
  deleteConversation,
  fetchConversations,
  type Conversation,
} from "./lib/api"
import { PAGE_TITLES, type Page } from "./lib/navigation"

const COLLAPSE_KEY = "docentra.sidebarCollapsed"
const AUTO_HIDE_KEY = "docentra.sidebarAutoHide"

function readFlag(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === "1"
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0")
  } catch {
    // Preference just won't persist.
  }
}

function App() {
  const toast = useToast()
  const [page, setPage] = useState<Page>("chat")
  const {
    settings,
    setKey,
    setSelection,
    saveCustomProvider,
    removeCustomProvider,
  } = useModelSettings()

  // Chats
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationError, setConversationError] = useState("")
  // null until we know which chat to open (latest one, or a new one).
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [startupError, setStartupError] = useState("")
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeMessageCount, setActiveMessageCount] = useState<number | null>(null)

  // Documents the next question is limited to (empty = all documents).
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  // Collection the next question is limited to, on top of the ticked documents.
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionScope | null>(null)
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const recentDocuments = useRecentDocuments(
    documentsVersion + (page === "documents" ? 0 : 1),
  )

  // Shell
  // `collapsed` is the saved, manual choice. `autoHidden` is the temporary
  // focus state after sending a prompt: it never touches the saved choice and
  // only applies while the chat is on screen.
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSE_KEY, false))
  const [autoHideEnabled, setAutoHideEnabled] = useState(() => readFlag(AUTO_HIDE_KEY, true))
  const [autoHidden, setAutoHidden] = useState(false)
  // Set when the sidebar is reopened by hand, so the next prompt in this chat
  // doesn't take it away again.
  const [keepOpen, setKeepOpen] = useState(false)
  const sidebarHidden = collapsed || (autoHidden && page === "chat")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const refreshConversations = useCallback(async () => {
    try {
      const data = await fetchConversations()
      setConversations(data)
      setConversationError("")
      return data
    } catch (error) {
      console.error("Failed to load conversations:", error)
      setConversationError("Unable to load chats.")
      return null
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

  // Open the latest chat, or create the first one.
  useEffect(() => {
    let cancelled = false

    async function start() {
      const data = await fetchConversations()
      if (cancelled) return
      setConversations(data)
      setIsLoadingConversations(false)

      if (data.length > 0) {
        setConversationId(data[0].id)
        return
      }
      const created = await createConversation()
      if (cancelled) return
      setConversations([created])
      setConversationId(created.id)
    }

    start().catch((error: Error) => {
      console.error("Failed to open a conversation:", error)
      if (cancelled) return
      setIsLoadingConversations(false)
      setConversationError("Unable to load chats.")
      setStartupError(
        "Can't reach the Docentra backend. Make sure it is running on port 8080, then reload.",
      )
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Reload the chat list when the window regains focus.
  useEffect(() => {
    function onFocus() {
      void refreshConversations()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refreshConversations])

  function navigate(next: Page) {
    setPage(next)
    setMobileOpen(false)
  }

  async function handleNewChat() {
    if (isCreatingConversation) return

    // Reuse the open chat if nothing has been asked in it yet.
    if (page === "chat" && conversationId !== null && activeMessageCount === 0) {
      setMobileOpen(false)
      document.querySelector<HTMLTextAreaElement>("#composer-input")?.focus()
      return
    }

    setIsCreatingConversation(true)
    try {
      const created = await createConversation()
      setConversations((list) => [created, ...list.filter((c) => c.id !== created.id)])
      setConversationId(created.id)
      setActiveMessageCount(0)
      setSelectedDocIds([])
      setSelectedCollection(null)
      navigate("chat")
    } catch (error) {
      console.error("Failed to create conversation:", error)
      toast("Couldn't start a new chat.", "error")
    } finally {
      setIsCreatingConversation(false)
    }
  }

  function handleSelectConversation(id: string) {
    if (id !== conversationId) {
      setSelectedDocIds([])
      setSelectedCollection(null)
      setActiveMessageCount(null)
    }
    setConversationId(id)
    navigate("chat")
  }

  function handleAskDocument(documentId: string) {
    setSelectedDocIds((ids) => (ids.includes(documentId) ? ids : [...ids, documentId]))
    // Asking one document means that document, not the collection it may be in.
    setSelectedCollection(null)
    navigate("chat")
  }

  function handleAskCollection(scope: CollectionScope) {
    setSelectedCollection(scope)
    setSelectedDocIds([])
    navigate("chat")
  }

  function handleCollectionChanged(scope: CollectionScope) {
    setSelectedCollection((current) =>
      current?.id === scope.id ? scope : current,
    )
  }

  function handleCollectionDeleted(id: string) {
    setSelectedCollection((current) => (current?.id === id ? null : current))
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteConversation(deleteTarget.id)
      const remaining = conversations.filter((c) => c.id !== deleteTarget.id)
      setConversations(remaining)
      if (deleteTarget.id === conversationId) {
        setSelectedDocIds([])
        setSelectedCollection(null)
        if (remaining.length > 0) setConversationId(remaining[0].id)
        else {
          const created = await createConversation()
          setConversations([created])
          setConversationId(created.id)
        }
      }
      setDeleteTarget(null)
      toast("Chat deleted")
    } catch (error) {
      console.error("Failed to delete conversation:", error)
      toast("Failed to delete this chat.", "error")
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSidebar = useCallback(() => {
    const show = sidebarHidden
    setAutoHidden(false)
    setKeepOpen(show)
    setCollapsed(!show)
    writeFlag(COLLAPSE_KEY, !show)
  }, [sidebarHidden])

  // Each chat starts with the sidebar back and auto-hide armed again.
  const [sidebarChatId, setSidebarChatId] = useState(conversationId)
  if (sidebarChatId !== conversationId) {
    setSidebarChatId(conversationId)
    setAutoHidden(false)
    setKeepOpen(false)
  }

  const handlePromptSent = useCallback(() => {
    if (autoHideEnabled && !keepOpen) setAutoHidden(true)
  }, [autoHideEnabled, keepOpen])

  function changeAutoHide(enabled: boolean) {
    setAutoHideEnabled(enabled)
    writeFlag(AUTO_HIDE_KEY, enabled)
    if (!enabled) setAutoHidden(false)
  }

  // Global shortcuts: Cmd/Ctrl+K opens search, Cmd/Ctrl+B toggles the sidebar.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (!mod || event.altKey || event.shiftKey) return
      const key = event.key.toLowerCase()
      if (key === "k") {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      } else if (key === "b") {
        event.preventDefault()
        if (window.matchMedia("(min-width: 1024px)").matches) toggleSidebar()
        else setMobileOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleSidebar])

  const activeConversation = conversations.find((c) => c.id === conversationId)
  const title =
    page === "chat"
      ? activeConversation
        ? conversationTitle(activeConversation)
        : "Docentra"
      : PAGE_TITLES[page]

  useEffect(() => {
    document.title = title === "Docentra" ? "Docentra" : `${title} · Docentra`
  }, [title])

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-900 text-paper">
      <Sidebar
        activePage={page}
        activeConversationId={conversationId}
        conversations={conversations}
        isLoadingConversations={isLoadingConversations}
        conversationError={conversationError}
        onNavigate={navigate}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => void handleNewChat()}
        onRequestDelete={setDeleteTarget}
        onOpenSearch={() => setPaletteOpen(true)}
        hidden={sidebarHidden}
        onToggleHidden={toggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          subtitle={
            page !== "chat"
              ? undefined
              : selectedCollection
                ? `· scoped to collection ${selectedCollection.name}${
                    selectedDocIds.length > 0
                      ? ` + ${documentCountLabel(selectedDocIds.length)}`
                      : ""
                  }`
                : selectedDocIds.length > 0
                  ? `· scoped to ${documentCountLabel(selectedDocIds.length)}`
                  : undefined
          }
          sidebarHidden={sidebarHidden}
          onShowSidebar={toggleSidebar}
          onOpenMenu={() => setMobileOpen(true)}
          onOpenSearch={() => setPaletteOpen(true)}
          onNewChat={() => void handleNewChat()}
          titleOnMobileOnly={page !== "chat"}
        />

        {page === "chat" && conversationId === null ? (
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <BrandMark size={44} className={startupError ? "opacity-60" : "animate-pulse"} />
            <p className="max-w-sm text-[13px] leading-6 text-white/45">
              {startupError || "Loading your workspace..."}
            </p>
          </main>
        ) : page === "chat" && conversationId !== null ? (
          <MainChat
            key={conversationId}
            conversationId={conversationId}
            modelSettings={settings}
            onSelectModel={setSelection}
            onOpenSettings={() => navigate("settings")}
            onOpenDocuments={() => navigate("documents")}
            selectedDocIds={selectedDocIds}
            onChangeSelectedDocIds={setSelectedDocIds}
            selectedCollection={selectedCollection}
            onChangeSelectedCollection={setSelectedCollection}
            recentDocuments={recentDocuments}
            onDocumentsChanged={() => setDocumentsVersion((v) => v + 1)}
            onTitleChanged={() => void refreshConversations()}
            onMessageCountChange={setActiveMessageCount}
            onPromptSent={handlePromptSent}
          />
        ) : page === "documents" ? (
          <DocumentsPage onAskDocument={handleAskDocument} />
        ) : page === "collections" ? (
          <CollectionsPage
            onAskCollection={handleAskCollection}
            onCollectionChanged={handleCollectionChanged}
            onCollectionDeleted={handleCollectionDeleted}
          />
        ) : page === "history" ? (
          <HistoryPage
            conversations={conversations}
            isLoading={isLoadingConversations}
            error={conversationError}
            onOpen={handleSelectConversation}
            onDelete={setDeleteTarget}
            onNewChat={() => void handleNewChat()}
          />
        ) : (
          <SettingsPage
            keys={settings.keys}
            customProviders={settings.customProviders}
            onSetKey={setKey}
            onSaveCustom={saveCustomProvider}
            onRemoveCustom={removeCustomProvider}
            autoHideSidebar={autoHideEnabled}
            onSetAutoHideSidebar={changeAutoHide}
          />
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          conversations={conversations}
          documents={recentDocuments}
          onNewChat={() => void handleNewChat()}
          onNavigate={navigate}
          onSelectConversation={handleSelectConversation}
          onAskDocument={handleAskDocument}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete chat?"
        icon={<Trash2 size={18} />}
        description={
          <>
            <span className="font-medium text-white/85">
              “{deleteTarget ? conversationTitle(deleteTarget) : ""}”
            </span>{" "}
            and all of its messages will be permanently deleted.
          </>
        }
        busy={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default App
