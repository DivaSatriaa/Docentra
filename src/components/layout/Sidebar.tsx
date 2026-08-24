import {
  ChevronDown,
  Clock3,
  FileText,
  FolderOpen,
  History,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react"

import logo from "../../assets/docentra-logo.png"
import FileTypeIcon from "../common/FileTypeIcon"

const recentDocuments = [
  { name: "Machine Learning.pdf", type: "pdf" },
  { name: "Sistem Pakar.docx", type: "docx" },
  { name: "Tugas Akhir.pdf", type: "pdf" },
  { name: "Data Mining.pdf", type: "pdf" },
]

type Page = "chat" | "documents" | "collections" | "history"

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  onNewChat: () => void
}

export default function Sidebar({
  activePage,
  onNavigate,
  onNewChat,
}: SidebarProps) {
  return (
    <aside className="relative flex h-screen w-[280px] shrink-0 overflow-hidden border-r border-white/[0.07] bg-[#1d1d20]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(142,58,89,0.08),transparent_38%),radial-gradient(circle_at_20%_85%,rgba(92,31,69,0.10),transparent_40%)]" />

      {/* Sidebar content */}
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
            onClick={onNewChat}
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
            onClick={() => onNavigate("documents")}
          />

          <SidebarItem
            icon={<FolderOpen size={18} />}
            label="Collections"
            active={activePage === "collections"}
            onClick={() => onNavigate("collections")}
          />

          <SidebarItem
            icon={<History size={18} />}
            label="History"
            active={activePage === "history"}
            onClick={() => onNavigate("history")}
          />
        </nav>

        {/* Recent */}
        <div className="px-5 pt-8">
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

          <div className="space-y-1">
            {recentDocuments.map((document) => (
              <button
                key={document.name}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/[0.04]"
              >
                <FileTypeIcon
                  type={document.type}
                  size={20}
                />

                <span className="truncate text-[12px] text-white/65">
                  {document.name}
                </span>
              </button>
            ))}

            <button className="flex items-center gap-2 px-2 py-2 text-[12px] text-white/35 transition hover:text-white/60">
              <Plus size={13} />
              More
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-auto px-5 pb-4">
          {/* Settings */}
          <button className="mb-4 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white">
            <Settings size={17} strokeWidth={1.8} />
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