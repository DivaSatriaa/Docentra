import { useEffect, useRef, type ReactNode } from "react"

import Button from "./Button"

/** Centered modal with backdrop, Escape-to-close and initial focus. */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  className = "max-w-md",
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      "[data-autofocus], input, textarea, button:not([disabled])",
    )
    focusable?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`w-full animate-pop-in rounded-2xl border border-white/[0.09] bg-ink-850 p-6 shadow-2xl shadow-black/60 ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

/** Yes/no confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busyLabel = "Deleting...",
  busy = false,
  icon,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  busyLabel?: string
  busy?: boolean
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onCancel()
      }}
      labelledBy="confirm-dialog-title"
    >
      {icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/[0.08] text-red-300">
          {icon}
        </div>
      )}
      <h2
        id="confirm-dialog-title"
        className="font-display text-[16px] font-medium text-white"
      >
        {title}
      </h2>
      <div className="mt-2 text-[13px] leading-6 text-white/55">
        {description}
      </div>
      <div className="mt-6 flex items-center justify-end gap-2">
        <Button size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={onConfirm}
          disabled={busy}
          data-autofocus
        >
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
