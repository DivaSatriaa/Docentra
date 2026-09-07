import {
  FileText,
  Grid2X2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

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
  page_count?: number | null
  created_at: string
  updated_at: string
}

type ViewMode = "grid" | "list"

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

function getFileIconClass(
  document: Document,
) {
  const type = getFileType(document)

  if (type === "PDF") {
    return "text-[#ff5964]"
  }

  if (
    type === "DOCX" ||
    type === "DOC"
  ) {
    return "text-[#5da7ff]"
  }

  return "text-[#C46A8A]"
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

export default function DocumentsPage() {
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

    if (!file) {
      return
    }

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

  const filteredDocuments = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase()

    if (!query) {
      return documents
    }

    return documents.filter(
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
  ])

  return (
    <main className="relative min-w-0 flex-1 overflow-y-auto bg-[#18181b]">
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[760px] -translate-x-1/2 rounded-full bg-[#8E3A59]/[0.08] blur-[150px]" />

        <div className="absolute left-[25%] top-[20%] h-[300px] w-[420px] rounded-full bg-[#5C1F45]/[0.04] blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1120px] px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[30px] font-medium tracking-[-0.02em] text-[#F2F2F2]">
              Documents
            </h1>

            <p className="mt-2 text-sm text-white/40">
              Manage and explore your knowledge base.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.pptx"
              onChange={handleUpload}
            />

            <button
              type="button"
              onClick={handleOpenUpload}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-xl bg-[#8E3A59] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(142,58,89,0.18)] transition hover:bg-[#9d4564] disabled:cursor-not-allowed disabled:opacity-50"
            >
            <Upload
              size={17}
              strokeWidth={1.9}
            />

              {isUploading
                ? "Uploading..."
                : "Upload Document"}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-red-400/10 bg-red-400/[0.035] px-4 py-3">
            <p className="text-xs text-red-300/75">
              {uploadError}
            </p>

            <button
              type="button"
              onClick={() => setUploadError("")}
              className="text-xs text-white/30 transition hover:text-white/60"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3">
            <Search
              size={17}
              strokeWidth={1.8}
              className="shrink-0 text-white/30"
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search documents..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>

          <button className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white">
            All
          </button>

          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
            <button
              type="button"
              onClick={() =>
                setViewMode("grid")
              }
              aria-label="Grid view"
              className={[
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                viewMode === "grid"
                  ? "bg-white/[0.07] text-white"
                  : "text-white/35 hover:text-white/70",
              ].join(" ")}
            >
              <Grid2X2 size={15} />
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode("list")
              }
              aria-label="List view"
              className={[
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                viewMode === "list"
                  ? "bg-white/[0.07] text-white"
                  : "text-white/35 hover:text-white/70",
              ].join(" ")}
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Count */}
        <div className="mt-7">
          <span className="text-xs font-medium text-white/35">
            {filteredDocuments.length}{" "}
            {filteredDocuments.length ===
            1
              ? "document"
              : "documents"}
          </span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mt-10 flex items-center justify-center py-16 text-white/30">
            <div className="flex items-center gap-2 text-sm">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Loading documents...
            </div>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="mt-6 rounded-2xl border border-red-400/10 bg-red-400/[0.035] px-4 py-4">
            <p className="text-sm text-red-300/75">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadDocuments()
              }
              className="mt-3 text-xs font-medium text-red-200/70 transition hover:text-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading &&
          !error &&
          filteredDocuments.length ===
            0 && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.015] px-6 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
                <FileText
                  size={22}
                  strokeWidth={1.7}
                  className="text-white/25"
                />
              </div>

              <h2 className="mt-4 text-sm font-medium text-white/65">
                {searchQuery.trim()
                  ? "No matching documents"
                  : "No documents yet"}
              </h2>

              <p className="mt-1.5 max-w-sm text-xs leading-5 text-white/30">
                {searchQuery.trim()
                  ? "Try a different search term."
                  : "Upload a document to start building your knowledge base."}
              </p>
            </div>
          )}

        {/* Grid */}
        {!isLoading &&
          !error &&
          filteredDocuments.length > 0 &&
          viewMode === "grid" && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDocuments.map(
                (document) => {
                  const status =
                    getStatusStyles(
                      document.processing_status,
                    )
                  const isProcessing =
                    document.processing_status.toLowerCase() ===
                      "processing" ||
                    document.processing_status.toLowerCase() ===
                      "pending"

                  return (
                    <div
                      key={document.id}
                      className={[
                        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition duration-200",
                        "hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.035]",
                        isProcessing
                          ? "document-processing-shimmer"
                          : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05]">
                          <FileText
                            size={20}
                            strokeWidth={1.7}
                            className={getFileIconClass(
                              document,
                            )}
                          />
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`More actions for ${
                              document.original_name ||
                              document.name
                            }`}
                            onClick={(event) => {
                              event.stopPropagation()

                              setMenuDocumentId((current) =>
                                current === document.id
                                  ? null
                                  : document.id,
                              )
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-white/70"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {menuDocumentId === document.id && (
                            <div className="absolute right-0 top-10 z-30 w-36 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1d1d21] p-1 shadow-2xl shadow-black/40">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuDocumentId(null)
                                  setRenameTarget(document)
                                  setRenameValue(
                                    document.name ||
                                      document.original_name ||
                                      "",
                                  )
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white transition hover:bg-white/[0.05]"
                              >
                                <Pencil className="h-4 w-4" />
                                Rename
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setMenuDocumentId(null)
                                  setDeleteTarget(document)
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-white/[0.05]"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="truncate text-sm font-medium text-white/85">
                          {document.name ||
                            document.original_name}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-white/35">
                          <span>
                            {getFileType(
                              document,
                            )}
                          </span>

                          <span className="text-white/15">
                            ·
                          </span>

                          <span>
                            {formatFileSize(
                              document.file_size,
                            )}
                          </span>

                          {document.page_count != null && (
                            <>
                              <span className="text-white/15">
                                ·
                              </span>

                              <span>
                                {document.page_count}{" "}
                                {document.page_count ===
                                1
                                  ? "page"
                                  : "pages"}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="text-[11px] text-white/25">
                            Updated{" "}
                            {formatDate(
                              document.updated_at,
                            )}
                          </div>

                          <span
                            className={[
                              "rounded-md border px-1.5 py-0.5 text-[9px] font-medium",
                              status.className,
                            ].join(" ")}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          )}

        {/* List */}
        {!isLoading &&
          !error &&
          filteredDocuments.length > 0 &&
          viewMode === "list" && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
              {filteredDocuments.map(
                (document, index) => {
                  const status =
                    getStatusStyles(
                      document.processing_status,
                    )

                  return (
                    <button
                      key={document.id}
                      type="button"
                      className={[
                        "group flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025]",
                        index > 0
                          ? "border-t border-white/[0.06]"
                          : "",
                      ].join(" ")}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                        <FileText
                          size={18}
                          strokeWidth={1.7}
                          className={getFileIconClass(
                            document,
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white/80">
                          {document.name ||
                            document.original_name}
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/30">
                          <span>
                            {getFileType(
                              document,
                            )}
                          </span>

                          <span className="text-white/15">
                            ·
                          </span>

                          <span>
                            {formatFileSize(
                              document.file_size,
                            )}
                          </span>

                          {document.page_count != null && (
                            <>
                              <span className="text-white/15">
                                ·
                              </span>

                              <span>
                                {document.page_count}{" "}
                                {document.page_count ===
                                1
                                  ? "page"
                                  : "pages"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className={[
                          "hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-medium sm:block",
                          status.className,
                        ].join(" ")}
                      >
                        {status.label}
                      </span>

                      <div className="hidden shrink-0 text-[11px] text-white/25 md:block">
                        {formatDate(
                          document.updated_at,
                        )}
                      </div>

                      <MoreHorizontal
                        size={18}
                        className="shrink-0 text-white/20 transition group-hover:text-white/45"
                      />
                    </button>
                  )
                },
              )}
            </div>
          )}
      </div>

      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!isRenaming) {
              setRenameTarget(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1c1c20] p-6 shadow-2xl shadow-black/50"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-medium text-white">
              Rename document
            </h2>

            <p className="mt-2 text-[13px] leading-6 text-white/40">
              Choose a new name for this document.
            </p>

            <input
              autoFocus
              value={renameValue}
              onChange={(event) =>
                setRenameValue(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleRename()
                }

                if (event.key === "Escape") {
                  setRenameTarget(null)
                }
              }}
              className="mt-5 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#8E3A59]/50"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isRenaming}
                onClick={() => setRenameTarget(null)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  isRenaming ||
                  !renameValue.trim()
                }
                onClick={() => {
                  void handleRename()
                }}
                className="rounded-lg bg-[#8E3A59] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#9d4564] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRenaming
                  ? "Renaming..."
                  : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!isDeleting) {
              setDeleteTarget(null)
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1c1c20] p-6 shadow-2xl shadow-black/50"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/10 bg-red-400/[0.07]">
              <Trash2
                size={18}
                className="text-red-300"
              />
            </div>

            <h2 className="text-[15px] font-medium text-white">
              Delete document?
            </h2>

            <p className="mt-2 text-[13px] leading-6 text-white/50">
              Are you sure you want to delete{" "}
              <span className="font-medium text-white/80">
                "{deleteTarget.name ||
                  deleteTarget.original_name}"
              </span>
              ?
              <br />
              This action cannot be undone.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() =>
                  setDeleteTarget(null)
                }
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  void handleDelete()
                }}
                className="rounded-lg bg-red-400/[0.12] px-4 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/[0.18] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
} 