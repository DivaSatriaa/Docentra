import Sidebar from "./Sidebar"
import MainChat from "./MainChat"

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#222224] text-[#F2F2F2]">
      <Sidebar />
      <MainChat />
    </div>
  )
}