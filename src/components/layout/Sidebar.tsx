import {
  FileText,
  FolderOpen,
  History,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react"
import { useSyncExternalStore, type ReactNode } from "react"

import logo from "../../assets/docentra-logo.png"
import { Kbd } from "../ui/Page"
import {
  conversationTitle,
  groupByDate,
  type Conversation,
} from "../../lib/api"
import { MOD_KEY, type Page } from "../../lib/navigation"
import { useDisplayName } from "../../lib/profile"

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
  /** Desktop only: the sidebar is slid fully off to the left. */
  hidden: boolean
  onToggleHidden: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const NAV: { page: Page; label: string; icon: typeof MessageSquare }[] = [
  { page: "chat", label: "Chat", icon: MessageSquare },
  { page: "documents", label: "Documents", icon: FileText },
  { page: "collections", label: "Collections", icon: FolderOpen },
  { page: "history", label: "History", icon: History },
]

const DESKTOP_QUERY = "(min-width: 1024px)"

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  )
}

export default function Sidebar(props: SidebarProps) {
  const { hidden, mobileOpen, onCloseMobile } = props
  const isDesktop = useIsDesktop()
  // Off-screen means out of the tab order too.
  const offscreen = isDesktop ? hidden : !mobileOpen

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* On desktop the outer box animates its width while the fixed-width
          panel stays pinned to its right edge, so the panel slides out left
          and the page widens in one motion. On mobile it is a drawer. */}
      <aside
        inert={offscreen}
        aria-label="Primary"
        className={[
          "fixed inset-y-0 left-0 z-50 h-full w-[272px] shrink-0 overflow-hidden transition-[width,translate] duration-300 ease-out-soft",
          "lg:relative lg:z-auto lg:translate-x-0",
          mobileOpen
            ? "translate-x-0 shadow-[0_0_80px_rgba(0,0,0,0.7)] lg:shadow-none"
            : "-translate-x-full",
          hidden ? "lg:w-0" : "lg:w-[272px]",
        ].join(" ")}
      >
        <div
          className={[
            "absolute inset-y-0 right-0 flex w-[272px] flex-col border-r border-white/[0.06] bg-ink-950 transition-opacity duration-300",
            hidden ? "lg:opacity-0" : "lg:opacity-100",
          ].join(" ")}
        >
          {/* Ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_42%_at_0%_0%,rgb(142_58_89/0.16),transparent_70%),radial-gradient(90%_36%_at_100%_100%,rgb(92_31_69/0.2),transparent_72%)]"
          />

          <div className="relative z-10 flex h-full flex-col">
            <ExpandedContent {...props} />
          </div>
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
  onToggleHidden,
  onCloseMobile,
}: SidebarProps) {
  const displayName = useDisplayName()
  const groups = groupByDate(conversations)

  return (
    <>
      {/* Brand */}
      <div className="flex h-14 items-center justify-between gap-2 pl-5 pr-2.5">
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
          onClick={onToggleHidden}
          aria-label="Hide sidebar"
          title={`Hide sidebar (${MOD_KEY}+B)`}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white lg:flex"
        >
          <PanelLeftClose size={17} />
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Primary actions */}
      <div className="space-y-2 px-3 pt-1">
        <button
          type="button"
          onClick={onNewChat}
          className="brand-fill flex h-10 w-full items-center gap-2.5 rounded-xl px-3.5 text-[13px] font-medium active:translate-y-px"
        >
          <Plus size={17} strokeWidth={2.2} />
          New Chat
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 text-[13px] text-white/40 transition hover:border-white/[0.13] hover:bg-white/[0.04] hover:text-white/75"
        >
          <Search size={15} />
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
            icon={<Icon size={17} />}
            label={label}
            active={activePage === page}
            onClick={() => onNavigate(page)}
          />
        ))}
      </nav>

      {/* Conversations */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between px-5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/30">
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
                <div className="px-3 pb-1 text-[11px] text-white/30">{group.label}</div>
                {group.items.map((conversation) => {
                  const active =
                    activePage === "chat" && activeConversationId === conversation.id
                  const title = conversationTitle(conversation)

                  return (
                    <div
                      key={conversation.id}
                      className={[
                        "group relative flex items-center rounded-lg transition",
                        active ? "brand-wash" : "hover:bg-white/[0.045]",
                      ].join(" ")}
                    >
                      {active && (
                        <span className="absolute inset-y-[7px] left-0 w-[2.5px] rounded-full bg-gradient-to-b from-brand-300 to-brand-500" />
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
                        <Trash2 size={14} />
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
          icon={<Settings size={17} />}
          label="Settings"
          active={activePage === "settings"}
          onClick={() => onNavigate("settings")}
        />
        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
          <Avatar />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white/90">{displayName}</div>
            <div className="truncate text-[11px] text-white/35">Personal workspace</div>
          </div>
        </div>
      </div>
    </>
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
        "relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] transition",
        active
          ? "brand-wash font-medium text-white"
          : "text-white/55 hover:bg-white/[0.045] hover:text-white",
      ].join(" ")}
    >
      <span className={active ? "text-brand-300" : "text-white/45"}>{icon}</span>
      {label}
    </button>
  )
}

export function Avatar({ size = 32 }: { size?: number }) {
  const initial = useDisplayName().charAt(0).toUpperCase()
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-plum text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/10"
    >
      {initial}
    </div>
  )
}
