import { useCallback, useState } from "react"

import Button from "../ui/Button"
import { Dialog } from "../ui/Dialog"

type FormValues = { name: string; description: string }

interface CollectionFormDialogProps {
  open: boolean
  /** Set when renaming an existing collection. */
  initial?: { name: string; description?: string | null }
  onClose: () => void
  onSubmit: (values: FormValues) => Promise<void>
}

const FIELD =
  "mt-1.5 w-full rounded-xl border border-white/[0.09] bg-ink-900 px-3 py-2.5 text-[13.5px] text-white outline-none transition placeholder:text-white/25 focus:border-brand-500/60"

/** Create or rename a collection. */
export default function CollectionFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: CollectionFormDialogProps) {
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  return (
    <Dialog open={open} onClose={close} labelledBy="collection-form-title">
      {/* Mounted only while open, so the fields start fresh each time. */}
      <CollectionForm
        initial={initial}
        busy={busy}
        onBusyChange={setBusy}
        onCancel={close}
        onSubmit={onSubmit}
      />
    </Dialog>
  )
}

function CollectionForm({
  initial,
  busy,
  onBusyChange,
  onCancel,
  onSubmit,
}: {
  initial?: { name: string; description?: string | null }
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onSubmit: (values: FormValues) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [error, setError] = useState("")
  const isEdit = initial !== undefined

  async function submit() {
    if (busy || !name.trim()) return
    onBusyChange(true)
    setError("")
    try {
      await onSubmit({ name: name.trim(), description: description.trim() })
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
        id="collection-form-title"
        className="font-display text-[16px] font-medium text-white"
      >
        {isEdit ? "Rename collection" : "New collection"}
      </h2>
      <p className="mt-1.5 text-[13px] text-white/45">
        {isEdit
          ? "Change the name or description. Its documents stay as they are."
          : "Group documents so you can ask all of them at once."}
      </p>

      <label className="mt-5 block text-[12px] text-white/50">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          placeholder="e.g. KKN"
          className={FIELD}
        />
      </label>

      <label className="mt-4 block text-[12px] text-white/50">
        Description <span className="text-white/30">(optional)</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="What is this collection for?"
          className={`${FIELD} resize-none leading-6`}
        />
      </label>

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
          disabled={busy || !name.trim()}
        >
          {busy ? "Saving..." : isEdit ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  )
}
