import {
  Grid2X2,
  List,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  SearchX,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import FileTypeIcon from "../components/common/FileTypeIcon"
import Button, { IconButton } from "../components/ui/Button"
import { ConfirmDialog, Dialog } from "../components/ui/Dialog"
import {
  EmptyState,
  PageContainer,
  PageHeader,
  SearchField,
} from "../components/ui/Page"
import { useToast } from "../components/ui/Toast"
import { API_BASE_URL, WORKSPACE_ID } from "../lib/api"
import { ACCEPTED_FILE_TYPES } from "../lib/documents"

type Document = {
  id: string
  workspace_id: string
  name: string
  original_name: string
  mime_type: string
  extension?: string | null
  file_size: number
  storage_path: string
  processing_status: string
  processing_error?: string | null
  page_count?: number | null
  created_at: string
  updated_at: string
}

type ViewMode = "grid" | "list"
type StatusFilter = "all" | "ready" | "processing" | "failed"

function statusGroup(status: string): Exclude<StatusFilter, "all"> | "other" {
  const s = status.toLowerCase()
  if (s === "ready" || s === "completed" || s === "processed") return "ready"
  if (s === "processing" || s === "pending") return "processing"
  if (s === "failed" || s === "error") return "failed"
  return "other"
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B"
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ]

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )

  const value = bytes / 1024 ** exponent

  return `${value.toFixed(
    exponent === 0 ? 0 : value >= 10 ? 1 : 2,
  )} ${units[exponent]}`
}

function formatDate(dateString: string) {
  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return "Unknown date"
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date)
}

function getFileType(document: Document) {
  const extension =
    document.extension?.trim().toLowerCase()

  if (extension) {
    return extension.replace(".", "").toUpperCase()
  }

  if (document.mime_type === "application/pdf") {
    return "PDF"
  }

  if (
    document.mime_type.includes(
      "word",
    ) ||
    document.mime_type.includes(
      "document",
    )
  ) {
    return "DOCX"
  }

  return "FILE"
}

function getStatusStyles(
  status: string,
) {
  switch (status.toLowerCase()) {
    case "ready":
    case "completed":
    case "processed":
      return {
        label: "Ready",
        className:
          "border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300/80",
      }

    case "processing":
    case "pending":
      return {
        label:
          status.charAt(0).toUpperCase() +
          status.slice(1),
        className:
          "border-amber-400/10 bg-amber-400/[0.06] text-amber-300/80",
      }

    case "failed":
    case "error":
      return {
        label: "Failed",
        className:
          "border-red-400/10 bg-red-400/[0.06] text-red-300/80",
      }

    default:
      return {
        label:
          status
            ? status.charAt(0).toUpperCase() +
              status.slice(1)
            : "Unknown",
        className:
          "border-white/[0.08] bg-white/[0.03] text-white/35",
      }
  }
}

export default function DocumentsPage({
  onAskDocument,
}: {
  /** Open the chat scoped to this document. */
  onAskDocument: (documentId: string) => void
}) {
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [isDragging, setIsDragging] = useState(false)
  const [documents, setDocuments] = useState<
    Document[]
  >([])

  const [searchQuery, setSearchQuery] =
    useState("")

  const [viewMode, setViewMode] =
    useState<ViewMode>("grid")

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [isUploading, setIsUploading] =
    useState(false)

  const [uploadError, setUploadError] =
    useState("")

  const [menuDocumentId, setMenuDocumentId] =
    useState<string | null>(null)

  const [renameTarget, setRenameTarget] =
    useState<Document | null>(null)

  const [renameValue, setRenameValue] =
    useState("")

  const [isRenaming, setIsRenaming] =
    useState(false)

  const [deleteTarget, setDeleteTarget] =
    useState<Document | null>(null)

  const [isDeleting, setIsDeleting] =
    useState(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  function handleOpenUpload() {
    setUploadError("")
    fileInputRef.current?.click()
  }

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    // Reset input supaya file yang sama bisa dipilih lagi
    event.target.value = ""

    if (file) {
      await uploadFile(file)
    }
  }

  async function uploadFile(file: File) {
    try {
      setIsUploading(true)
      setUploadError("")

      const allowedExtensions = [
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".md",
        ".csv",
        ".xlsx",
        ".pptx",
      ]

      const extension = file.name.includes(".")
        ? `.${file.name.split(".").pop()?.toLowerCase()}`
        : ""

      if (!allowedExtensions.includes(extension)) {
        throw new Error(
          "Unsupported file type. Use PDF, DOC, DOCX, TXT, MD, CSV, XLSX, or PPTX.",
        )
      }

      const formData = new FormData()

      formData.append("workspace_id", WORKSPACE_ID)
      formData.append("file", file)

      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents`,
        {
          method: "POST",
          body: formData,
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ??
            `Upload failed: ${response.status}`,
        )
      }

      // Refresh daftar setelah upload berhasil
      await loadDocuments()
      toast(`Uploaded “${file.name}”. Processing...`)
    } catch (requestError) {
      console.error(
        "Failed to upload document:",
        requestError,
      )

      setUploadError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload document.",
      )
    } finally {
      setIsUploading(false)
    }
  }

  async function loadDocuments(
    showLoading = false,
  ) {
    setError("")

    if (showLoading) {
      setIsLoading(true)
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents`,
      )

      if (!response.ok) {
        throw new Error(
          `Failed to load documents: ${response.status}`,
        )
      }

      const data: Document[] =
        await response.json()

      const sortedDocuments = [...data].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime(),
      )

      setDocuments(sortedDocuments)
    } catch (requestError) {
      console.error(
        "Failed to load documents:",
        requestError,
      )

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load your documents.",
      )
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }

  async function handleRename() {
    if (!renameTarget) {
      return
    }

    const trimmedName = renameValue.trim()

    if (!trimmedName) {
      return
    }

    try {
      setIsRenaming(true)

      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents/${renameTarget.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
          }),
        },
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Failed to rename document",
        )
      }

      setDocuments((current) =>
        current.map((document) =>
          document.id === renameTarget.id
            ? data
            : document,
        ),
      )

      setRenameTarget(null)
      setRenameValue("")
    } catch (requestError) {
      console.error(
        "Failed to rename document:",
        requestError,
      )

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to rename document.",
      )
    } finally {
      setIsRenaming(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return
    }

    try {
      setIsDeleting(true)

      const response = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents/${deleteTarget.id}`,
        {
          method: "DELETE",
        },
      )

      if (!response.ok) {
        const body = await response.text()

        let message = ""

        try {
          const data = JSON.parse(body)
          message = data?.error ?? ""
        } catch {
          message = body
        }

        throw new Error(
          message || `Delete failed (${response.status})`,
        )
      }

      setDocuments((current) =>
        current.filter(
          (document) =>
            document.id !== deleteTarget.id,
        ),
      )

      setDeleteTarget(null)
    } catch (requestError) {
      console.error(
        "Failed to delete document:",
        requestError,
      )

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete document.",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRetry(documentId: string) {
    try {
      await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents/${documentId}/reprocess`,
        { method: "POST" },
      )
    } catch (requestError) {
      console.error(
        "Failed to retry document:",
        requestError,
      )
    } finally {
      void loadDocuments(false)
    }
  }

  useEffect(() => {
    void loadDocuments(true)
  }, [])

  useEffect(() => {
    const hasProcessingDocuments = documents.some(
      (document) => {
        const status =
          document.processing_status.toLowerCase()

        return (
          status === "pending" ||
          status === "processing"
        )
      },
    )

    if (!hasProcessingDocuments) {
      return
    }

    const interval = window.setInterval(() => {
      void loadDocuments(false)
    }, 2000)

    return () => {
      window.clearInterval(interval)
    }
  }, [documents])

  // Close the card menu on any outside click or Escape.
  useEffect(() => {
    if (!menuDocumentId) return
    function close() {
      setMenuDocumentId(null)
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
  }, [menuDocumentId])

  const statusCounts = useMemo(() => {
    const counts = { all: documents.length, ready: 0, processing: 0, failed: 0 }
    for (const document of documents) {
      const group = statusGroup(document.processing_status)
      if (group !== "other") counts[group] += 1
    }
    return counts
  }, [documents])

  const filteredDocuments = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase()

    const byStatus =
      statusFilter === "all"
        ? documents
        : documents.filter(
            (document) =>
              statusGroup(document.processing_status) === statusFilter,
          )

    if (!query) {
      return byStatus
    }

    return byStatus.filter(
      (document) =>
        document.name
          .toLowerCase()
          .includes(query) ||
        document.original_name
          .toLowerCase()
          .includes(query),
    )
  }, [
    documents,
    searchQuery,
    statusFilter,
  ])

  const isFiltering = searchQuery.trim() !== "" || statusFilter !== "all"

  function renderMenu(document: Document) {
    return (
      <div className="relative">
        <IconButton
          size="sm"
          aria-label={`More actions for ${document.name || document.original_name}`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() =>
            setMenuDocumentId((current) =>
              current === document.id ? null : document.id,
            )
          }
          className="text-white/35"
        >
          <MoreHorizontal size={17} />
        </IconButton>

        {menuDocumentId === document.id && (
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="absolute right-0 top-9 z-30 w-40 animate-pop-in overflow-hidden rounded-xl border border-white/[0.09] bg-ink-850 p-1 shadow-2xl shadow-black/50"
          >
            <MenuItem
              icon={<Pencil size={14} />}
              label="Rename"
              onClick={() => {
                setMenuDocumentId(null)
                setRenameTarget(document)
                setRenameValue(document.name || document.original_name || "")
              }}
            />
            <MenuItem
              icon={<Trash2 size={14} />}
              label="Delete"
              danger
              onClick={() => {
                setMenuDocumentId(null)
                setDeleteTarget(document)
              }}
            />
          </div>
        )}
      </div>
    )
  }

  function renderMeta(document: Document) {
    return (
      <>
        <span>{getFileType(document)}</span>
        <span className="text-white/15">·</span>
        <span>{formatFileSize(document.file_size)}</span>
        {document.page_count != null && (
          <>
            <span className="text-white/15">·</span>
            <span>
              {document.page_count} {document.page_count === 1 ? "page" : "pages"}
            </span>
          </>
        )}
      </>
    )
  }

  function renderStatus(document: Document, className = "") {
    const status = getStatusStyles(document.processing_status)
    const group = statusGroup(document.processing_status)
    return (
      <span
        className={[
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium",
          status.className,
          className,
        ].join(" ")}
      >
        <span
          className={[
            "h-1.5 w-1.5 rounded-full bg-current",
            group === "processing" ? "animate-pulse" : "",
          ].join(" ")}
        />
        {status.label}
      </span>
    )
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault()
          setIsDragging(true)
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        const file = event.dataTransfer.files?.[0]
        if (file) void uploadFile(file)
      }}
    >
      {isDragging && (
        <div
          className="absolute inset-3 z-40 flex animate-fade-in flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-400/70 bg-ink-900/90 backdrop-blur-sm"
          onDragLeave={() => setIsDragging(false)}
        >
          <UploadCloud size={36} className="text-brand-300" />
          <p className="mt-3 font-display text-[17px] font-medium text-white">
            Drop to upload
          </p>
          <p className="mt-1 text-[13px] text-white/45">
            PDF, DOCX, TXT, MD, CSV, XLSX or PPTX
          </p>
        </div>
      )}

      <PageContainer>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleUpload}
        />

        <PageHeader
          title="Documents"
          description="Upload files, then ask Docentra about them."
          actions={
            <Button variant="primary" onClick={handleOpenUpload} disabled={isUploading}>
              <Upload size={16} strokeWidth={2} />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          }
        />

        {uploadError && (
          <div
            role="alert"
            className="mt-5 flex animate-rise-in items-center justify-between gap-4 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3"
          >
            <p className="text-[13px] text-red-200/85">{uploadError}</p>
            <button
              type="button"
              onClick={() => setUploadError("")}
              className="text-[12px] text-white/40 transition hover:text-white/75"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search documents..."
            className="min-w-[200px] flex-1"
          />

          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex h-10 items-center gap-0.5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-1"
          >
            {(["all", "ready", "processing", "failed"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={statusFilter === value}
                onClick={() => setStatusFilter(value)}
                className={[
                  "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] capitalize transition",
                  statusFilter === value
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:text-white/80",
                ].join(" ")}
              >
                {value}
                <span className="text-[11px] text-white/30">{statusCounts[value]}</span>
              </button>
            ))}
          </div>

          <div className="flex h-10 items-center rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
            {(
              [
                ["grid", Grid2X2, "Grid view"],
                ["list", List, "List view"],
              ] as const
            ).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-label={label}
                aria-pressed={viewMode === mode}
                title={label}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg transition",
                  viewMode === mode
                    ? "bg-white/[0.08] text-white"
                    : "text-white/35 hover:text-white/70",
                ].join(" ")}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {!isLoading && !error && documents.length > 0 && (
          <p className="mt-6 text-[12px] text-white/35">
            {filteredDocuments.length}{" "}
            {filteredDocuments.length === 1 ? "document" : "documents"}
            {isFiltering && ` of ${documents.length}`}
          </p>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[168px] animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="mt-6 rounded-2xl border border-red-400/15 bg-red-500/[0.05] px-4 py-4">
            <p className="text-[13px] text-red-200/85">{error}</p>
            <button
              type="button"
              onClick={() => void loadDocuments(true)}
              className="mt-2 text-[12px] font-medium text-red-100/80 transition hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filteredDocuments.length === 0 && (
          <div className="mt-6">
            {documents.length === 0 ? (
              <button
                type="button"
                onClick={handleOpenUpload}
                className="flex w-full flex-col items-center rounded-2xl border border-dashed border-white/[0.12] px-6 py-16 text-center transition hover:border-brand-500/50 hover:bg-brand-500/[0.04]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/[0.12] text-brand-300">
                  <UploadCloud size={22} />
                </span>
                <span className="mt-4 font-display text-[15px] font-medium text-white/90">
                  Upload your first document
                </span>
                <span className="mt-1.5 max-w-sm text-[13px] leading-6 text-white/45">
                  Click to browse, or drag a file anywhere on this page. PDF, DOCX, TXT,
                  MD, CSV, XLSX and PPTX are supported.
                </span>
              </button>
            ) : (
              <EmptyState
                icon={<SearchX size={20} />}
                title="No matching documents"
                description="Try a different search term or status filter."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setSearchQuery("")
                      setStatusFilter("all")
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && !error && filteredDocuments.length > 0 && viewMode === "grid" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((document) => {
              const group = statusGroup(document.processing_status)

              return (
                <div
                  key={document.id}
                  className={[
                    "group relative flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition duration-200",
                    "hover:border-white/[0.13] hover:bg-white/[0.035]",
                    group === "processing" ? "document-processing-shimmer" : "",
                    menuDocumentId === document.id ? "z-20" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04]">
                      <FileTypeIcon type={document.extension ?? ""} size={28} />
                    </div>
                    {renderMenu(document)}
                  </div>

                  <div
                    className="mt-4 truncate text-[14px] font-medium text-white/90"
                    title={document.name || document.original_name}
                  >
                    {document.name || document.original_name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-white/40">
                    {renderMeta(document)}
                  </div>

                  {group === "failed" && (
                    <FailureNote
                      reason={document.processing_error}
                      onRetry={() => void handleRetry(document.id)}
                    />
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <div className="flex items-center gap-2">
                      {renderStatus(document)}
                      <span className="text-[11px] text-white/30">
                        {formatDate(document.updated_at)}
                      </span>
                    </div>

                    {group === "ready" && (
                      <button
                        type="button"
                        onClick={() => onAskDocument(document.id)}
                        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-brand-300 transition hover:bg-brand-500/15 hover:text-white"
                      >
                        <MessageSquarePlus size={14} />
                        Ask
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List */}
        {!isLoading && !error && filteredDocuments.length > 0 && viewMode === "list" && (
          <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.015]">
            {filteredDocuments.map((document, index) => {
              const group = statusGroup(document.processing_status)

              return (
                <div
                  key={document.id}
                  className={[
                    "group relative flex items-center gap-3.5 px-4 py-3 transition hover:bg-white/[0.025]",
                    index > 0 ? "border-t border-white/[0.05]" : "",
                    menuDocumentId === document.id ? "z-20" : "",
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
                      {renderMeta(document)}
                    </div>
                    {group === "failed" && (
                      <FailureNote
                        reason={document.processing_error}
                        onRetry={() => void handleRetry(document.id)}
                      />
                    )}
                  </div>

                  {renderStatus(document, "hidden sm:inline-flex")}

                  <div className="hidden w-[96px] shrink-0 text-right text-[11.5px] text-white/30 md:block">
                    {formatDate(document.updated_at)}
                  </div>

                  <div className="flex w-[64px] shrink-0 justify-end">
                    {group === "ready" && (
                      <button
                        type="button"
                        onClick={() => onAskDocument(document.id)}
                        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-brand-300 transition hover:bg-brand-500/15 hover:text-white"
                      >
                        <MessageSquarePlus size={14} />
                        Ask
                      </button>
                    )}
                  </div>

                  {renderMenu(document)}
                </div>
              )
            })}
          </div>
        )}
      </PageContainer>

      <Dialog
        open={renameTarget !== null}
        onClose={() => {
          if (!isRenaming) setRenameTarget(null)
        }}
        labelledBy="rename-document-title"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleRename()
          }}
        >
          <h2
            id="rename-document-title"
            className="font-display text-[16px] font-medium text-white"
          >
            Rename document
          </h2>
          <p className="mt-1.5 text-[13px] text-white/45">
            Choose a new name for this document.
          </p>
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onFocus={(event) => {
              // Select the name without the extension.
              const dot = event.target.value.lastIndexOf(".")
              event.target.setSelectionRange(0, dot > 0 ? dot : event.target.value.length)
            }}
            className="mt-5 w-full rounded-xl border border-white/[0.09] bg-ink-900 px-3 py-2.5 text-[13.5px] text-white outline-none transition focus:border-brand-500/60"
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button size="sm" disabled={isRenaming} onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              variant="primary"
              disabled={isRenaming || !renameValue.trim()}
            >
              {isRenaming ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete document?"
        icon={<Trash2 size={18} strokeWidth={1.8} />}
        description={
          <>
            <span className="font-medium text-white/85">
              “{deleteTarget?.name || deleteTarget?.original_name}”
            </span>{" "}
            and its search index will be removed from your workspace.
            This can't be undone.
          </>
        }
        busy={isDeleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
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

/** Why processing failed, with a retry action. */
function FailureNote({
  reason,
  onRetry,
}: {
  reason?: string | null
  onRetry: () => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-red-400/10 bg-red-400/[0.04] px-2.5 py-2 text-[11px] leading-4 text-red-200/70">
      <span>
        {reason?.trim() ||
          "Processing failed. Try again."}
      </span>{" "}
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation()
          onRetry()
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            event.stopPropagation()
            onRetry()
          }
        }}
        className="cursor-pointer font-medium text-red-200 underline underline-offset-2 hover:text-white"
      >
        Retry
      </span>
    </div>
  )
}
