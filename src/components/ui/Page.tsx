import { Search, X } from "lucide-react"
import type { ReactNode } from "react"

/** Scrollable page body with the brand's ambient glow. */
export function PageContainer({
  children,
  width = "max-w-[1120px]",
}: {
  children: ReactNode
  width?: string
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <AmbientGlow />
      <div className={`relative z-10 mx-auto w-full ${width} px-4 py-6 sm:px-8 sm:py-8`}>
        {children}
      </div>
    </div>
  )
}

export function AmbientGlow() {
  return <div className="ambient" aria-hidden="true" />
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-paper sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[14px] text-white/45">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label
      className={`flex h-10 min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 transition focus-within:border-brand-500/60 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(142,58,89,0.14)] ${className}`}
    >
      <Search size={16} className="shrink-0 text-white/35" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="rounded p-0.5 text-white/35 transition hover:text-white"
        >
          <X size={14} />
        </button>
      )}
    </label>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex animate-rise-in flex-col items-center rounded-2xl border border-dashed border-white/[0.09] px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl icon-tile">
        {icon}
      </div>
      <h3 className="font-display text-[15px] font-medium text-white/90">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-6 text-white/45">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/[0.1] border-b-white/[0.05] bg-white/[0.05] px-1.5 shadow-[0_1px_0_rgba(0,0,0,0.4)] font-sans text-[10.5px] font-medium text-white/45">
      {children}
    </kbd>
  )
}
