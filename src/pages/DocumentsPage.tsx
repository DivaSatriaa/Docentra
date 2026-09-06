import {
  FileText,
  Grid2X2,
  List,
  Loader2,
  MoreHorizontal,
  Search,
  Upload,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

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

  async function loadDocuments() {
    setError("")
    setIsLoading(true)

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

      const sortedDocuments = [
        ...data,
      ].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime(),
      )

      setDocuments(
        sortedDocuments,
      )
    } catch (requestError) {
      console.error(
        "Failed to load documents:",
        requestError,
      )

      setError(
        "Unable to load your documents.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDocuments()
  }, [])

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

          <button className="flex items-center gap-2 rounded-xl bg-[#8E3A59] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(142,58,89,0.18)] transition hover:bg-[#9d4564]">
            <Upload
              size={17}
              strokeWidth={1.9}
            />
            Upload Document
          </button>
        </div>

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

                  return (
                    <button
                      key={document.id}
                      type="button"
                      className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.035]"
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

                        <MoreHorizontal
                          size={18}
                          className="text-white/25 transition group-hover:text-white/50"
                        />
                      </div>

                      <div className="mt-5">
                        <div className="truncate text-sm font-medium text-white/85">
                          {document.original_name ||
                            document.name}
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
                    </button>
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
                          {document.original_name ||
                            document.name}
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
    </main>
  )
}