import { Menu, Plus, Search } from "lucide-react"

import { IconButton } from "../ui/Button"
import { MOD_KEY } from "../../lib/navigation"

export default function TopBar({
  title,
  subtitle,
  onOpenMenu,
  onOpenSearch,
  onNewChat,
  titleOnMobileOnly = false,
}: {
  title: string
  subtitle?: string
  onOpenMenu: () => void
  onOpenSearch: () => void
  onNewChat: () => void
  /** Pages with their own large heading only need the title on small screens. */
  titleOnMobileOnly?: boolean
}) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.05] bg-ink-900/70 px-3 backdrop-blur-md sm:px-5">
      <IconButton aria-label="Open menu" onClick={onOpenMenu} className="lg:hidden">
        <Menu size={18} strokeWidth={1.8} />
      </IconButton>
      <div
        className={`flex min-w-0 flex-1 items-baseline gap-2 px-1 ${titleOnMobileOnly ? "lg:invisible" : ""}`}
      >
        <h1 className="truncate text-[14px] font-medium text-white/90">{title}</h1>
        {subtitle && (
          <span className="hidden truncate text-[12px] text-white/30 sm:inline">
            {subtitle}
          </span>
        )}
      </div>

      <IconButton aria-label={`Search (${MOD_KEY}+K)`} onClick={onOpenSearch}>
        <Search size={17} strokeWidth={1.8} />
      </IconButton>
      <IconButton aria-label="New chat" onClick={onNewChat} className="lg:hidden">
        <Plus size={18} strokeWidth={1.9} />
      </IconButton>
    </header>
  )
}
