import { Check, FileText, FolderOpen, Loader2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { API_BASE_URL, WORKSPACE_ID } from "../../lib/api"
import {
  documentCountLabel,
  fetchCollection,
  fetchCollections,
  type Collection,
  type CollectionScope,
} from "../../lib/collections"

type DocumentItem = {
  id: string
  original_name: string
  processing_status: string
}

interface DocumentScopePickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  selectedCollection: CollectionScope | null
  onChangeCollection: (scope: CollectionScope | null) => void
  disabled?: boolean
}

const GROUP_LABEL =
  "px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-wide text-white/30"

/**
 * Lets the user limit a question to one collection and/or specific documents.
 * Nothing selected = all documents.
 */
export default function DocumentScopePicker({
  selectedIds,
  onChange,
  selectedCollection,
  onChangeCollection,
  disabled = false,
}: DocumentScopePickerProps) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  // Member documents of the selected collection, once loaded.
  const [members, setMembers] = useState<{
    collectionId: string
    ids: string[]
  } | null>(null)
  const [error, setError] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const collectionId = selectedCollection?.id ?? null

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

  // Refetch each time the menu opens so new uploads and collections show up.
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

    fetchCollections()
      .then((data) => {
        if (!cancelled) setCollections(data)
      })
      .catch(() => {
        // Scoping by document still works without the collections list.
      })

    return () => {
      cancelled = true
    }
  }, [open])

  // Load the selected collection's members (again whenever the menu opens).
  useEffect(() => {
    if (collectionId === null) return

    let cancelled = false

    fetchCollection(collectionId)
      .then((detail) => {
        if (cancelled) return
        setMembers({
          collectionId,
          ids: detail.documents.map((document) => document.id),
        })
      })
      .catch(() => {
        // If the collection is gone, sending the question reports it.
      })

    return () => {
      cancelled = true
    }
  }, [collectionId, open])

  const memberIds =
    members !== null && members.collectionId === collectionId ? members.ids : null

  // A ticked document that is also a member would be counted twice in the
  // label; the collection already covers it.
  useEffect(() => {
    if (memberIds === null) return
    if (selectedIds.some((id) => memberIds.includes(id))) {
      onChange(selectedIds.filter((id) => !memberIds.includes(id)))
    }
  }, [memberIds, selectedIds, onChange])

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    )
  }

  function toggleCollection(collection: Collection) {
    onChangeCollection(
      collection.id === collectionId
        ? null
        : { id: collection.id, name: collection.name },
    )
  }

  const count = selectedIds.length
  const hasScope = count > 0 || selectedCollection !== null
  const label = selectedCollection
    ? count > 0
      ? `${selectedCollection.name} + ${documentCountLabel(count)}`
      : selectedCollection.name
    : count === 0
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
        title={label}
        className={[
          "flex h-8 max-w-[200px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40",
          hasScope ? "icon-tile" : "text-white/55",
        ].join(" ")}
      >
        {selectedCollection ? (
          <FolderOpen size={14} className="shrink-0" />
        ) : (
          <FileText size={14} className="shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[320px] animate-pop-in rounded-xl border border-white/[0.09] bg-ink-850 p-2 surface-pop">
          <div className="mb-1 flex items-center justify-between px-2.5 py-1.5">
            <span className="text-[11px] text-white/40">
              Search only in...
            </span>
            {hasScope && (
              <button
                type="button"
                onClick={() => {
                  onChange([])
                  onChangeCollection(null)
                }}
                className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white"
              >
                <X size={11} />
                Clear
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {collections.length > 0 && (
              <>
                <div className={GROUP_LABEL}>Collections</div>
                {collections.map((collection) => {
                  const active = collection.id === collectionId
                  const empty = collection.document_count === 0
                  // An empty collection only makes sense with a ticked document.
                  const blocked = empty && !active && count === 0

                  return (
                    <button
                      key={collection.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={blocked}
                      title={blocked ? "This collection has no documents" : undefined}
                      onClick={() => toggleCollection(collection)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white disabled:pointer-events-none disabled:opacity-40"
                    >
                      <FolderOpen size={13} className="shrink-0 text-white/40" />
                      <span className="min-w-0 flex-1 truncate">
                        {collection.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-white/30">
                        {empty ? "empty" : collection.document_count}
                      </span>
                      {active && (
                        <Check size={13} className="shrink-0 text-brand-300" />
                      )}
                    </button>
                  )
                })}
                <div className={GROUP_LABEL}>Documents</div>
              </>
            )}

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
                const isMember = memberIds?.includes(item.id) ?? false
                const active = isMember || selectedIds.includes(item.id)

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={isMember}
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white disabled:pointer-events-none"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {item.original_name}
                    </span>
                    {isMember && selectedCollection && (
                      <span className="max-w-[110px] shrink-0 truncate text-[11px] text-white/35">
                        in {selectedCollection.name}
                      </span>
                    )}
                    {active && (
                      <Check
                        size={13}
                        className={`shrink-0 ${isMember ? "text-brand-300/50" : "text-brand-300"}`}
                      />
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
