import { useState } from "react"

import Sidebar from "./Sidebar"
import MainChat from "./MainChat"

type Page = "chat" | "documents" | "collections" | "history"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

const INITIAL_CONVERSATION_ID =
  "ffa568ee-88e0-445a-a58f-9b8fd65fde5b"

type ConversationResponse = {
  id: string
  workspace_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export default function AppShell() {
  const [activePage, setActivePage] =
    useState<Page>("chat")

  const [conversationId, setConversationId] =
    useState(INITIAL_CONVERSATION_ID)

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
      setActivePage("chat")
    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error,
      )
    } finally {
      setIsCreatingConversation(false)
    }
  }

  function handleNavigate(page: Page) {
    setActivePage(page)
  }

  function handleSelectConversation(id: string) {
    setConversationId(id)
    setActivePage("chat")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#222224] text-[#F2F2F2]">
      <Sidebar
        activePage={activePage}
        activeConversationId={conversationId}
        onNavigate={handleNavigate}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      {activePage === "chat" ? (
        <MainChat
          conversationId={conversationId}
        />
      ) : (
        <main className="flex min-w-0 flex-1 items-center justify-center bg-[#18181b] text-white/40">
          <p className="text-sm">
            {activePage.charAt(0).toUpperCase() +
              activePage.slice(1)}{" "}
            page
          </p>
        </main>
      )}
    </div>
  )
}