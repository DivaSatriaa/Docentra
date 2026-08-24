import { useState } from "react"

import Sidebar from "./components/layout/Sidebar"
import MainChat from "./components/layout/MainChat"
import DocumentsPage from "./pages/DocumentsPage"
import CollectionsPage from "./pages/CollectionsPage"

type Page = "chat" | "documents" | "collections"

function App() {
  const [page, setPage] = useState<Page>("chat")

  return (
    <div className="flex h-screen overflow-hidden bg-[#18181b] text-[#F2F2F2]">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
      />

      {page === "chat" ? (
        <MainChat />
      ) : page === "documents" ?(
        <DocumentsPage />
      ) : (
        <CollectionsPage />
      )}
    </div>
  )
}

export default App