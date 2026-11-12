import { Check, FileText, Loader2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

type DocumentItem = {
  id: string
  original_name: string
  processing_status: string
}

interface DocumentScopePickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/** Lets the user limit a question to specific documents. Empty = all documents. */
export default function DocumentScopePicker({
  selectedIds,
  onChange,
  disabled = false,
}: DocumentScopePickerProps) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null)
  const [error, setError] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  // Refetch each time the menu opens so new uploads show up.
  useEffect(() => {
    if (!open) return

    let cancelled = false

    fetch(`${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`)
        return (await response.json()) as DocumentItem[]
      })
      .then((data) => {
        if (cancelled) return
        setError("")
        setDocuments(data.filter((item) => item.processing_status === "ready"))
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    )
  }

  const count = selectedIds.length
  const label =
    count === 0
      ? "All documents"
      : count === 1
        ? (documents?.find((d) => d.id === selectedIds[0])?.original_name ??
          "1 document")
        : `${count} documents`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          "flex max-w-[200px] items-center gap-2 rounded-lg border px-3.5 py-2 text-[12px] transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40",
          count > 0
            ? "border-[#8E3A59]/50 text-[#C46A8A]"
            : "border-white/[0.08] text-white/50",
        ].join(" ")}
      >
        <FileText size={14} strokeWidth={1.8} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[320px] rounded-xl border border-white/[0.09] bg-[#1c1c20] p-2 shadow-2xl shadow-black/50">
          <div className="mb-1 flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] text-white/40">
              Search only in...
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white"
              >
                <X size={11} />
                Clear
              </button>
            )}
          </div>

          <div className="max-h-[260px] overflow-y-auto">
            {error ? (
              <p className="px-2 py-4 text-center text-[12px] text-red-300/80">
                {error}
              </p>
            ) : documents === null ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-white/40">
                <Loader2 size={14} className="animate-spin" />
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12px] leading-5 text-white/40">
                No processed documents yet. Upload one in the Documents page.
              </p>
            ) : (
              documents.map((item) => {
                const active = selectedIds.includes(item.id)

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="truncate">{item.original_name}</span>
                    {active && (
                      <Check size={13} className="shrink-0 text-[#C46A8A]" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
