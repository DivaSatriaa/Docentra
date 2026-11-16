import { Check, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import FileTypeIcon from "../common/FileTypeIcon"
import Button from "../ui/Button"
import { Dialog } from "../ui/Dialog"
import { SearchField } from "../ui/Page"
import { documentCountLabel } from "../../lib/collections"
import {
  fetchDocuments,
  formatFileSize,
  type WorkspaceDocument,
} from "../../lib/documents"

interface AddDocumentsDialogProps {
  open: boolean
  /** Documents already in the collection. */
  excludeIds: string[]
  onClose: () => void
  onAdd: (documentIds: string[]) => Promise<void>
}

/** Pick workspace documents to add to a collection. */
export default function AddDocumentsDialog({
  open,
  excludeIds,
  onClose,
  onAdd,
}: AddDocumentsDialogProps) {
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  return (
    <Dialog
      open={open}
      onClose={close}
      labelledBy="add-documents-title"
      className="max-w-lg"
    >
      {/* Mounted only while open, so the list is fresh each time. */}
      <DocumentChooser
        excludeIds={excludeIds}
        busy={busy}
        onBusyChange={setBusy}
        onCancel={close}
        onAdd={onAdd}
      />
    </Dialog>
  )
}

function DocumentChooser({
  excludeIds,
  busy,
  onBusyChange,
  onCancel,
  onAdd,
}: {
  excludeIds: string[]
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onAdd: (documentIds: string[]) => Promise<void>
}) {
  const [documents, setDocuments] = useState<WorkspaceDocument[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [checked, setChecked] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    fetchDocuments()
      .then((data) => {
        if (!cancelled) setDocuments(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const available = (documents ?? []).filter(
    (document) => !excludeIds.includes(document.id),
  )
  const needle = query.trim().toLowerCase()
  const visible = available.filter((document) =>
    (document.name || document.original_name).toLowerCase().includes(needle),
  )

  function toggle(id: string) {
    setChecked((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    )
  }

  async function submit() {
    if (busy || checked.length === 0) return
    onBusyChange(true)
    setError("")
    try {
      await onAdd(checked)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h2
        id="add-documents-title"
        className="font-display text-[16px] font-medium text-white"
      >
        Add documents
      </h2>
      <p className="mt-1.5 text-[13px] text-white/45">
        Documents stay in your library and can be in several collections.
      </p>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search documents..."
        className="mt-5"
      />

      <div className="mt-3 max-h-[300px] min-h-[120px] overflow-y-auto rounded-xl border border-white/[0.07] bg-white/[0.015] p-1">
        {loadError ? (
          <p className="px-3 py-8 text-center text-[12.5px] text-red-300/80">
            {loadError}
          </p>
        ) : documents === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-white/40">
            <Loader2 size={14} className="animate-spin" />
            Loading documents...
          </div>
        ) : available.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12.5px] leading-5 text-white/40">
            {documents.length === 0
              ? "No documents yet. Upload one in the Documents page."
              : "Every document is already in this collection."}
          </p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12.5px] text-white/40">
            No documents match.
          </p>
        ) : (
          visible.map((document) => {
            const active = checked.includes(document.id)
            const status = document.processing_status.toLowerCase()

            return (
              <label
                key={document.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-white/[0.05]"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle(document.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/60",
                    active
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-white/20",
                  ].join(" ")}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                </span>
                <FileTypeIcon type={document.extension ?? ""} size={20} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">
                  {document.name || document.original_name}
                </span>
                {status !== "ready" && (
                  <span
                    className={`shrink-0 text-[11px] ${status === "failed" ? "text-red-300/80" : "text-amber-200/70"}`}
                  >
                    {status === "failed" ? "failed" : "processing"}
                  </span>
                )}
                <span className="shrink-0 text-[11.5px] text-white/30">
                  {formatFileSize(document.file_size)}
                </span>
              </label>
            )
          })
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          type="submit"
          variant="primary"
          disabled={busy || checked.length === 0}
        >
          {busy
            ? "Adding..."
            : checked.length === 0
              ? "Add documents"
              : `Add ${documentCountLabel(checked.length)}`}
        </Button>
      </div>
    </form>
  )
}
