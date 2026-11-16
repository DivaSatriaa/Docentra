import {
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import CollectionDetail from "../components/collections/CollectionDetail"
import CollectionFormDialog from "../components/collections/CollectionFormDialog"
import Button, { IconButton } from "../components/ui/Button"
import { ConfirmDialog } from "../components/ui/Dialog"
import {
  EmptyState,
  PageContainer,
  PageHeader,
  SearchField,
} from "../components/ui/Page"
import { useToast } from "../components/ui/Toast"
import { formatRelativeTime } from "../lib/api"
import {
  createCollection,
  deleteCollection,
  documentCountLabel,
  fetchCollections,
  updateCollection,
  type Collection,
  type CollectionScope,
} from "../lib/collections"

interface CollectionsPageProps {
  onAskCollection: (scope: CollectionScope) => void
  onCollectionChanged: (scope: CollectionScope) => void
  onCollectionDeleted: (id: string) => void
}

type FormState = { mode: "create" } | { mode: "edit"; collection: Collection }

export default function CollectionsPage({
  onAskCollection,
  onCollectionChanged,
  onCollectionDeleted,
}: CollectionsPageProps) {
  const toast = useToast()
  // null until the first load finishes.
  const [collections, setCollections] = useState<Collection[] | null>(null)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])
  const closeForm = useCallback(() => setForm(null), [])
  const closeDetail = useCallback(() => {
    setOpenId(null)
    reload()
  }, [reload])

  useEffect(() => {
    let cancelled = false

    fetchCollections()
      .then((data) => {
        if (cancelled) return
        setCollections(data)
        setError("")
      })
      .catch((err: Error) => {
        if (cancelled) return
        console.error("Failed to load collections:", err)
        setError("Unable to load collections.")
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Close the card menu on any outside click or Escape.
  useEffect(() => {
    if (!menuId) return
    function close() {
      setMenuId(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuId])

  async function submitForm(values: { name: string; description: string }) {
    if (!form) return

    if (form.mode === "create") {
      const created = await createCollection(values)
      setCollections((list) => [created, ...(list ?? [])])
      setForm(null)
      toast(`Created “${created.name}”`)
      return
    }

    const updated = await updateCollection(form.collection.id, values)
    setCollections((list) =>
      (list ?? []).map((item) => (item.id === updated.id ? updated : item)),
    )
    setForm(null)
    onCollectionChanged({ id: updated.id, name: updated.name })
    toast("Collection updated")
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteCollection(deleteTarget.id)
      setCollections((list) =>
        (list ?? []).filter((item) => item.id !== deleteTarget.id),
      )
      onCollectionDeleted(deleteTarget.id)
      setDeleteTarget(null)
      toast("Collection deleted")
    } catch (err) {
      console.error("Failed to delete collection:", err)
      toast("Failed to delete this collection.", "error")
      reload()
    } finally {
      setIsDeleting(false)
    }
  }

  if (openId !== null) {
    return (
      <CollectionDetail
        collectionId={openId}
        onBack={closeDetail}
        onAsk={onAskCollection}
        onChanged={reload}
      />
    )
  }

  const needle = query.trim().toLowerCase()
  const visible = (collections ?? []).filter((collection) =>
    `${collection.name} ${collection.description ?? ""}`
      .toLowerCase()
      .includes(needle),
  )
  const isLoading = collections === null && !error
  const showError = collections === null && error !== ""

  const newButton = (
    <Button variant="primary" onClick={() => setForm({ mode: "create" })}>
      <Plus size={16} strokeWidth={2.2} />
      New Collection
    </Button>
  )

  return (
    <>
      <PageContainer>
        <PageHeader
          title="Collections"
          description="Group documents into focused knowledge bases."
          actions={newButton}
        />

        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search collections..."
          className="mt-6"
        />

        {collections !== null && collections.length > 0 && (
          <p className="mt-6 text-[12px] text-white/35">
            {visible.length} collection{visible.length === 1 ? "" : "s"}
            {needle && ` of ${collections.length}`}
          </p>
        )}

        {isLoading && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[168px] animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        )}

        {showError && (
          <div className="mt-6 rounded-2xl border border-red-400/15 bg-red-500/[0.05] px-4 py-4">
            <p className="text-[13px] text-red-200/85">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-2 text-[12px] font-medium text-red-100/80 transition hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {collections !== null && visible.length === 0 && (
          <div className="mt-6">
            {collections.length === 0 ? (
              <EmptyState
                icon={<FolderOpen size={22} />}
                title="No collections yet"
                description="Create a collection, add documents to it, then ask all of them with one click."
                action={newButton}
              />
            ) : (
              <EmptyState
                icon={<FolderOpen size={22} />}
                title="No collections match"
                description="Try a different search."
              />
            )}
          </div>
        )}

        {visible.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {visible.map((collection) => (
              <div
                key={collection.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(collection.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setOpenId(collection.id)
                  }
                }}
                className={[
                  "group relative cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.02] surface-card p-5 text-left outline-none transition duration-200 hover:border-brand-500/35 hover:bg-white/[0.035] focus-visible:border-brand-500/60",
                  menuId === collection.id ? "z-20" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-tile">
                    <FolderOpen size={19} />
                  </div>

                  <div className="relative" onClick={(event) => event.stopPropagation()}>
                    <IconButton
                      size="sm"
                      aria-label={`More actions for ${collection.name}`}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() =>
                        setMenuId((current) =>
                          current === collection.id ? null : collection.id,
                        )
                      }
                      className="text-white/35"
                    >
                      <MoreHorizontal size={17} />
                    </IconButton>

                    {menuId === collection.id && (
                      <div
                        onMouseDown={(event) => event.stopPropagation()}
                        className="absolute right-0 top-9 z-30 w-40 animate-pop-in overflow-hidden rounded-xl border border-white/[0.09] bg-ink-850 p-1 surface-pop"
                      >
                        <MenuItem
                          icon={<Pencil size={14} />}
                          label="Rename"
                          onClick={() => {
                            setMenuId(null)
                            setForm({ mode: "edit", collection })
                          }}
                        />
                        <MenuItem
                          icon={<Trash2 size={14} />}
                          label="Delete"
                          danger
                          onClick={() => {
                            setMenuId(null)
                            setDeleteTarget(collection)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <h2 className="mt-4 truncate font-display text-[15px] font-medium text-white/90">
                  {collection.name}
                </h2>
                <p className="mt-1.5 line-clamp-2 min-h-5 text-[12.5px] leading-5 text-white/45">
                  {collection.description}
                </p>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5 text-[12px] text-white/35">
                  <span className="flex items-center gap-1.5">
                    <FileText size={13} />
                    {documentCountLabel(collection.document_count)}
                  </span>
                  <span className="truncate">
                    Updated {formatRelativeTime(collection.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContainer>

      <CollectionFormDialog
        open={form !== null}
        initial={form?.mode === "edit" ? form.collection : undefined}
        onClose={closeForm}
        onSubmit={submitForm}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete collection?"
        icon={<Trash2 size={18} />}
        description={
          <>
            <span className="font-medium text-white/85">
              “{deleteTarget?.name ?? ""}”
            </span>{" "}
            will be deleted. The documents in it are kept.
          </>
        }
        busy={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition",
        danger
          ? "text-red-300 hover:bg-red-400/10"
          : "text-white/80 hover:bg-white/[0.06] hover:text-white",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  )
}
