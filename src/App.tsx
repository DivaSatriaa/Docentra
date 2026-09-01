import { useState } from "react"

import Sidebar from "./components/layout/Sidebar"
import MainChat from "./components/layout/MainChat"
import DocumentsPage from "./pages/DocumentsPage"
import CollectionsPage from "./pages/CollectionsPage"
import HistoryPage from "./pages/HistoryPage"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

const INITIAL_CONVERSATION_ID =
  "ffa568ee-88e0-445a-a58f-9b8fd65fde5b"

type Page = "chat" | "documents" | "collections" | "history"

type ConversationResponse = {
  id: string
  workspace_id: string
  title: string | null
  created_at: string
  updated_at: string
}

function App() {
  const [page, setPage] = useState<Page>("chat")

  const [conversationId, setConversationId] = useState(
    INITIAL_CONVERSATION_ID,
  )

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#18181b] text-[#F2F2F2]">
      <Sidebar
        activePage={page}
        activeConversationId={conversationId}
        onNavigate={setPage}
        onSelectConversation={(id) => {
          setConversationId(id)
          setPage("chat")
        }}
        onNewChat={handleNewChat}
      />

      {page === "chat" ? (
        <MainChat
          conversationId={conversationId}
        />
      ) : page === "documents" ? (
        <DocumentsPage />
      ) : page === "collections" ? (
        <CollectionsPage />
      ) : (
        <HistoryPage />
      )}
    </div>
  )
}

export default App