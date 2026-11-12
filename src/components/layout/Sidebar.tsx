import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FolderOpen,
  History,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react"
import type { ReactNode } from "react"

import logo from "../../assets/docentra-logo.png"
import BrandMark from "../ui/BrandMark"
import { Kbd } from "../ui/Page"
import {
  conversationTitle,
  groupByDate,
  type Conversation,
} from "../../lib/api"
import { MOD_KEY, type Page } from "../../lib/navigation"

interface SidebarProps {
  activePage: Page
  activeConversationId: string | null
  conversations: Conversation[]
  isLoadingConversations: boolean
  conversationError: string
  onNavigate: (page: Page) => void
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onRequestDelete: (conversation: Conversation) => void
  onOpenSearch: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const NAV: { page: Page; label: string; icon: typeof MessageSquare }[] = [
  { page: "chat", label: "Chat", icon: MessageSquare },
  { page: "documents", label: "Documents", icon: FileText },
  { page: "collections", label: "Collections", icon: FolderOpen },
  { page: "history", label: "History", icon: History },
]

export default function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen, onCloseMobile } = props

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col border-r border-white/[0.06] bg-ink-850 transition-[width,transform] duration-200 ease-out",
          "lg:relative lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl shadow-black/60" : "-translate-x-full",
          collapsed ? "w-[272px] lg:w-[68px]" : "w-[272px]",
        ].join(" ")}
        aria-label="Primary"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-brand-500/[0.07] blur-[90px]" />
          <div className="absolute -left-20 bottom-24 h-64 w-64 rounded-full bg-plum/[0.10] blur-[90px]" />
        </div>

        <div className="relative z-10 flex h-full flex-col">
          {collapsed ? <CollapsedContent {...props} /> : <ExpandedContent {...props} />}
        </div>
      </aside>
    </>
  )
}

function ExpandedContent({
  activePage,
  activeConversationId,
  conversations,
  isLoadingConversations,
  conversationError,
  onNavigate,
  onSelectConversation,
  onNewChat,
  onRequestDelete,
  onOpenSearch,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const groups = groupByDate(conversations)

  return (
    <>
      {/* Brand */}
      <div className="flex h-16 items-center justify-between gap-2 pl-5 pr-3">
        <button
          type="button"
          onClick={() => onNavigate("chat")}
          className="rounded-md"
          aria-label="Docentra home"
        >
          <img
            src={logo}
            alt="Docentra"
            className="h-[22px] w-auto object-contain object-left"
            draggable={false}
          />
        </button>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-white lg:flex"
        >
          <ChevronsLeft size={17} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* Primary actions */}
      <div className="space-y-2 px-3 pt-2">
        <button
          type="button"
          onClick={onNewChat}
          className="group flex h-10 w-full items-center gap-2.5 rounded-xl bg-brand-500 px-3.5 text-[13px] font-medium text-white shadow-[0_10px_28px_-8px_rgba(142,58,89,0.65)] transition hover:bg-brand-400 active:bg-brand-600"
        >
          <Plus size={17} strokeWidth={2.2} />
          New Chat
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 text-[13px] text-white/40 transition hover:border-white/[0.12] hover:text-white/70"
        >
          <Search size={15} strokeWidth={1.8} />
          <span className="flex-1 text-left">Search</span>
          <span className="hidden gap-1 lg:flex">
            <Kbd>{MOD_KEY}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5 px-3 pt-4">
        {NAV.map(({ page, label, icon: Icon }) => (
          <NavItem
            key={page}
            icon={<Icon size={17} strokeWidth={1.8} />}
            label={label}
            active={activePage === page}
            onClick={() => onNavigate(page)}
          />
        ))}
      </nav>

      {/* Conversations */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between px-5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/30">
            Chats
          </span>
          {conversations.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("history")}
              className="text-[11px] text-white/30 transition hover:text-white/70"
            >
              View all
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {isLoadingConversations ? (
            <div className="space-y-1.5 px-2 pt-2">
              {[70, 55, 80, 45].map((width) => (
                <div
                  key={width}
                  className="h-7 animate-pulse rounded-lg bg-white/[0.035]"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          ) : conversationError ? (
            <p className="px-2 py-2 text-[12px] text-red-300/70">{conversationError}</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-2 text-[12px] leading-5 text-white/30">
              No chats yet. Start one with <span className="text-white/55">New Chat</span>.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mt-2.5 first:mt-1">
                <div className="px-2 pb-1 text-[11px] text-white/25">{group.label}</div>
                {group.items.map((conversation) => {
                  const active =
                    activePage === "chat" && activeConversationId === conversation.id
                  const title = conversationTitle(conversation)

                  return (
                    <div
                      key={conversation.id}
                      className={[
                        "group relative flex items-center rounded-lg transition",
                        active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      {active && (
                        <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-brand-300" />
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conversation.id)}
                        aria-current={active ? "page" : undefined}
                        title={title}
                        className={[
                          "min-w-0 flex-1 truncate py-2 pl-3 pr-1 text-left text-[13px]",
                          active ? "text-white" : "text-white/55 group-hover:text-white/85",
                        ].join(" ")}
                      >
                        {title}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRequestDelete(conversation)
                        }}
                        aria-label={`Delete ${title}`}
                        title="Delete chat"
                        className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/30 opacity-0 transition hover:bg-red-400/10 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] p-3">
        <NavItem
          icon={<Settings size={17} strokeWidth={1.8} />}
          label="Settings"
          active={activePage === "settings"}
          onClick={() => onNavigate("settings")}
        />
        <div className="mt-1 flex items-center gap-3 rounded-xl px-2.5 py-2">
          <Avatar />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">Divas</div>
            <div className="truncate text-[11px] text-white/35">Personal workspace</div>
          </div>
        </div>
      </div>
    </>
  )
}

function CollapsedContent({
  activePage,
  onNavigate,
  onNewChat,
  onOpenSearch,
  onToggleCollapsed,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col items-center gap-1 py-3">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label="Expand sidebar"
        title="Expand sidebar"
        className="group relative mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/[0.06]"
      >
        <BrandMark size={28} className="transition group-hover:opacity-0" />
        <ChevronsRight
          size={17}
          className="absolute text-white/70 opacity-0 transition group-hover:opacity-100"
        />
      </button>

      <RailButton label="New Chat" onClick={onNewChat} primary>
        <Plus size={18} strokeWidth={2.2} />
      </RailButton>
      <RailButton label={`Search (${MOD_KEY}+K)`} onClick={onOpenSearch}>
        <Search size={17} strokeWidth={1.8} />
      </RailButton>

      <div className="my-2 h-px w-8 bg-white/[0.07]" />

      {NAV.map(({ page, label, icon: Icon }) => (
        <RailButton
          key={page}
          label={label}
          active={activePage === page}
          onClick={() => onNavigate(page)}
        >
          <Icon size={18} strokeWidth={1.8} />
        </RailButton>
      ))}

      <div className="flex-1" />

      <RailButton
        label="Settings"
        active={activePage === "settings"}
        onClick={() => onNavigate("settings")}
      >
        <Settings size={18} strokeWidth={1.8} />
      </RailButton>
      <div className="mt-2">
        <Avatar />
      </div>
    </div>
  )
}

function RailButton({
  label,
  active = false,
  primary = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  primary?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "flex h-10 w-10 items-center justify-center rounded-xl transition",
        primary
          ? "bg-brand-500 text-white hover:bg-brand-400"
          : active
            ? "bg-white/[0.08] text-white"
            : "text-white/45 hover:bg-white/[0.05] hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] transition",
        active
          ? "bg-white/[0.07] font-medium text-white"
          : "text-white/55 hover:bg-white/[0.04] hover:text-white",
      ].join(" ")}
    >
      <span className={active ? "text-brand-300" : ""}>{icon}</span>
      {label}
    </button>
  )
}

export function Avatar({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-plum text-[12px] font-semibold text-white ring-1 ring-white/10"
    >
      D
    </div>
  )
}
