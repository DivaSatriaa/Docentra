import { Menu, PanelLeftOpen, Search, SquarePen } from "lucide-react"

import { IconButton } from "../ui/Button"
import { Kbd } from "../ui/Page"
import { MOD_KEY } from "../../lib/navigation"

export default function TopBar({
  title,
  subtitle,
  sidebarHidden,
  onShowSidebar,
  onOpenMenu,
  onOpenSearch,
  onNewChat,
  titleOnMobileOnly = false,
}: {
  title: string
  subtitle?: string
  /** Desktop: the sidebar is slid away, so its key actions move up here. */
  sidebarHidden: boolean
  onShowSidebar: () => void
  onOpenMenu: () => void
  onOpenSearch: () => void
  onNewChat: () => void
  /** Pages with their own large heading only need the title on small screens. */
  titleOnMobileOnly?: boolean
}) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-1 border-b border-white/[0.05] bg-ink-900/75 px-2.5 backdrop-blur-md sm:px-4">
      <IconButton aria-label="Open menu" onClick={onOpenMenu} className="lg:hidden">
        <Menu size={18} />
      </IconButton>

      {sidebarHidden && (
        <div className="hidden animate-fade-in items-center gap-1 lg:flex">
          <IconButton
            aria-label="Show sidebar"
            title={`Show sidebar (${MOD_KEY}+B)`}
            onClick={onShowSidebar}
          >
            <PanelLeftOpen size={17} />
          </IconButton>
          <IconButton aria-label="New chat" onClick={onNewChat}>
            <SquarePen size={16} />
          </IconButton>
          <span className="mx-1.5 h-4 w-px bg-white/[0.09]" />
        </div>
      )}

      <div
        className={`flex min-w-0 flex-1 items-baseline gap-2 px-1.5 ${titleOnMobileOnly ? "lg:invisible" : ""}`}
      >
        <h1 className="truncate text-[14px] font-medium text-white/90">{title}</h1>
        {subtitle && (
          <span className="hidden truncate text-[12px] text-white/35 sm:inline">
            {subtitle}
          </span>
        )}
      </div>

      {/* Search: a labelled pill when there is room and the sidebar's own
          search box is not on screen; otherwise a plain icon. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={`hidden h-8 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] pl-2.5 pr-1.5 text-[12px] text-white/40 transition hover:border-white/[0.13] hover:bg-white/[0.045] hover:text-white/75 md:flex ${sidebarHidden ? "" : "lg:hidden"}`}
      >
        <Search size={14} />
        Search
        <span className="ml-2 flex gap-1">
          <Kbd>{MOD_KEY}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <IconButton
        aria-label={`Search (${MOD_KEY}+K)`}
        onClick={onOpenSearch}
        className={sidebarHidden ? "md:hidden" : "md:hidden lg:inline-flex"}
      >
        <Search size={17} />
      </IconButton>
      <IconButton aria-label="New chat" onClick={onNewChat} className="lg:hidden">
        <SquarePen size={17} />
      </IconButton>
    </header>
  )
}
