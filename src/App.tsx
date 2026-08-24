import { useState } from "react"

import Sidebar from "./components/layout/Sidebar"
import MainChat from "./components/layout/MainChat"
import DocumentsPage from "./pages/DocumentsPage"
import CollectionsPage from "./pages/CollectionsPage"
import HistoryPage from "./pages/HistoryPage"

type Page = "chat" | "documents" | "collections" | "history"

function App() {
  const [page, setPage] = useState<Page>("chat")
  const [chatKey, setChatKey] = useState(0)

  function handleNewChat() {
    setPage("chat")
    setChatKey((current) => current + 1)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#18181b] text-[#F2F2F2]">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        onNewChat={handleNewChat}
      />

      {page === "chat" ? (
        <MainChat key={chatKey} />
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