import { useEffect, useState } from "react"

import Sidebar from "./components/layout/Sidebar"
import MainChat from "./components/layout/MainChat"
import DocumentsPage from "./pages/DocumentsPage"
import CollectionsPage from "./pages/CollectionsPage"
import HistoryPage from "./pages/HistoryPage"
import SettingsPage from "./pages/SettingsPage"
import { useModelSettings } from "./lib/modelSettings"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

const CONVERSATIONS_URL = `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/conversations`

type Page =
  | "chat"
  | "documents"
  | "collections"
  | "history"
  | "settings"

type ConversationResponse = {
  id: string
  workspace_id: string
  title: string | null
  created_at: string
  updated_at: string
}

function App() {
  const [page, setPage] = useState<Page>("chat")
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const {
    settings,
    setKey,
    setSelection,
    saveCustomProvider,
    removeCustomProvider,
  } = useModelSettings()

  // null until we know which chat to open (latest one, or a new one).
  const [conversationId, setConversationId] =
    useState<string | null>(null)
  const [startupError, setStartupError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function openLatestOrCreate(): Promise<string> {
      const response = await fetch(CONVERSATIONS_URL)

      if (!response.ok) {
        throw new Error(`Failed to load chats (${response.status})`)
      }

      const conversations: ConversationResponse[] = await response.json()

      if (conversations.length > 0) {
        return [...conversations].sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        )[0].id
      }

      const created = await fetch(CONVERSATIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      })

      if (!created.ok) {
        throw new Error(`Failed to create chat (${created.status})`)
      }

      return ((await created.json()) as ConversationResponse).id
    }

    openLatestOrCreate()
      .then((id) => {
        if (!cancelled) setConversationId(id)
      })
      .catch((error: Error) => {
        console.error("Failed to open a conversation:", error)
        if (!cancelled) {
          setStartupError(
            "Can't reach the Docentra backend. Make sure it is running on port 8080, then reload.",
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const [isCreatingConversation, setIsCreatingConversation] =
    useState(false)

  async function handleNewChat() {
    if (isCreatingConversation) {
      return
    }

    setIsCreatingConversation(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "New Chat",
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          `Failed to create conversation: ${response.status}`,
        )
      }

      const data: ConversationResponse =
        await response.json()

      setConversationId(data.id)
      setPage("chat")
    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error,
      )
    } finally {
      setIsCreatingConversation(false)
    }
  }

  function handleSelectConversation(id: string) {
    setConversationId(id)
    setPage("chat")
  }

  function handleDeleteConversation(
    deletedId: string,
    replacementId: string | null,
  ) {
    // Kalau yang dihapus bukan conversation aktif,
    // tidak perlu mengganti chat yang sedang dibuka.
    if (deletedId !== conversationId) {
      return
    }

    // Kalau masih ada conversation lain,
    // langsung pindah ke conversation tersebut.
    if (replacementId) {
      setConversationId(replacementId)
      setPage("chat")
      return
    }

    // Kalau sudah tidak ada conversation sama sekali,
    // buat conversation baru.
    void handleNewChat()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#18181b] text-[#F2F2F2]">
      <Sidebar
        activePage={page}
        activeConversationId={conversationId ?? ""}
        onNavigate={setPage}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        refreshKey={sidebarRefreshKey}
        onDeleteConversation={
          handleDeleteConversation
        }
      />

      {page === "chat" && conversationId === null ? (
        <main className="flex min-w-0 flex-1 items-center justify-center bg-[#18181b] px-8 text-center text-sm text-white/40">
          {startupError || "Loading..."}
        </main>
      ) : page === "chat" && conversationId !== null ? (
        <MainChat
          conversationId={conversationId}
          modelSettings={settings}
          onSelectModel={setSelection}
          onOpenSettings={() => setPage("settings")}
          onOpenDocuments={() => setPage("documents")}
          onTitleChanged={() =>
            setSidebarRefreshKey((value) => value + 1)
          }
        />
      ) : page === "documents" ? (
        <DocumentsPage />
      ) : page === "collections" ? (
        <CollectionsPage />
      ) : page === "history" ? (
        <HistoryPage />
      ) : (
        <SettingsPage
          keys={settings.keys}
          customProviders={settings.customProviders}
          onSetKey={setKey}
          onSaveCustom={saveCustomProvider}
          onRemoveCustom={removeCustomProvider}
        />
      )}
    </div>
  )
}

export default App