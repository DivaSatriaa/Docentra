import { ArrowLeft, FileText, MessageSquarePlus, Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import AddDocumentsDialog from "./AddDocumentsDialog"
import FileTypeIcon from "../common/FileTypeIcon"
import Button from "../ui/Button"
import { EmptyState, PageContainer } from "../ui/Page"
import { useToast } from "../ui/Toast"
import {
  addCollectionDocuments,
  documentCountLabel,
  fetchCollection,
  removeCollectionDocument,
  type CollectionDetail as CollectionDetailData,
  type CollectionScope,
} from "../../lib/collections"
import { formatFileSize } from "../../lib/documents"

interface CollectionDetailProps {
  collectionId: string
  onBack: () => void
  onAsk: (scope: CollectionScope) => void
  /** Called after documents were added or removed. */
  onChanged: () => void
}

/** One collection: its documents, with add, remove and "ask". */
export default function CollectionDetail({
  collectionId,
  onBack,
  onAsk,
  onChanged,
}: CollectionDetailProps) {
  const toast = useToast()
  const [detail, setDetail] = useState<CollectionDetailData | null>(null)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)

  const closeAdd = useCallback(() => setAddOpen(false), [])

  useEffect(() => {
    let cancelled = false

    fetchCollection(collectionId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setError("")
      })
      .catch((err: Error) => {
        if (cancelled) return
        console.error("Failed to load collection:", err)
        setError(
          err.message === "collection not found"
            ? "This collection no longer exists."
            : "Unable to load this collection.",
        )
      })

    return () => {
      cancelled = true
    }
  }, [collectionId, reloadKey])

  async function handleAdd(documentIds: string[]) {
    const updated = await addCollectionDocuments(collectionId, documentIds)
    setDetail(updated)
    setAddOpen(false)
    onChanged()
    toast(`Added ${documentCountLabel(documentIds.length)}`)
  }

  async function handleRemove(documentId: string) {
    if (!detail) return
    const previous = detail
    const documents = detail.documents.filter((item) => item.id !== documentId)

    setDetail({ ...detail, documents, document_count: documents.length })
    try {
      await removeCollectionDocument(collectionId, documentId)
      onChanged()
    } catch (err) {
      console.error("Failed to remove document from collection:", err)
      setDetail(previous)
      toast("Couldn't remove that document.", "error")
    }
  }

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 rounded-lg py-1 pr-2 text-[12.5px] text-white/45 transition hover:text-white"
    >
      <ArrowLeft size={14} />
      Collections
    </button>
  )

  if (detail === null) {
    return (
      <PageContainer>
        {back}
        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/15 bg-red-500/[0.05] px-4 py-4">
            <p className="text-[13px] text-red-200/85">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 text-[12px] font-medium text-red-100/80 transition hover:text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-6 h-[220px] animate-pulse rounded-2xl bg-white/[0.03]" />
        )}
      </PageContainer>
    )
  }

  const isEmpty = detail.documents.length === 0

  const addButton = (
    <Button onClick={() => setAddOpen(true)}>
      <Plus size={16} strokeWidth={2.2} />
      Add documents
    </Button>
  )

  return (
    <>
      <PageContainer>
        {back}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[26px] font-medium tracking-[-0.01em] text-paper sm:text-[30px]">
              {detail.name}
            </h1>
            {detail.description && (
              <p className="mt-1.5 text-[14px] text-white/45">
                {detail.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              disabled={isEmpty}
              title={isEmpty ? "Add documents first" : undefined}
              onClick={() => onAsk({ id: detail.id, name: detail.name })}
            >
              <MessageSquarePlus size={16} />
              Ask this collection
            </Button>
            {addButton}
          </div>
        </div>

        {isEmpty ? (
          <div className="mt-6">
            <EmptyState
              icon={<FileText size={22} />}
              title="No documents in this collection"
              description="Add documents from your library to ask them together."
              action={addButton}
            />
          </div>
        ) : (
          <>
            <p className="mt-6 text-[12px] text-white/35">
              {documentCountLabel(detail.documents.length)}
            </p>
            <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.015]">
              {detail.documents.map((document, index) => {
                const status = document.processing_status.toLowerCase()

                return (
                  <div
                    key={document.id}
                    className={[
                      "flex items-center gap-3.5 px-4 py-3 transition hover:bg-white/[0.025]",
                      index > 0 ? "border-t border-white/[0.05]" : "",
                    ].join(" ")}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                      <FileTypeIcon type={document.extension ?? ""} size={24} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-white/85">
                        {document.name || document.original_name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/35">
                        <span>{formatFileSize(document.file_size)}</span>
                        {status !== "ready" && (
                          <>
                            <span className="text-white/15">·</span>
                            <span
                              className={
                                status === "failed"
                                  ? "text-red-300/80"
                                  : "text-amber-200/70"
                              }
                            >
                              {status === "failed" ? "failed" : "processing"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRemove(document.id)}
                      aria-label={`Remove ${document.name || document.original_name} from this collection`}
                      className="h-7 shrink-0 rounded-lg px-2 text-[12px] font-medium text-white/45 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </PageContainer>

      <AddDocumentsDialog
        open={addOpen}
        excludeIds={detail.documents.map((document) => document.id)}
        onClose={closeAdd}
        onAdd={handleAdd}
      />
    </>
  )
}
