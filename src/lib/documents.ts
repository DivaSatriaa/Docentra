import { useEffect, useState } from "react"

const API_BASE_URL = "http://localhost:8080"

const WORKSPACE_ID =
  "5400fe40-1e5a-4d63-9ffe-06fb12621540"

const DOCUMENTS_URL = `${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/documents`

export type WorkspaceDocument = {
  id: string
  name: string
  original_name: string
  extension?: string | null
  file_size: number
  processing_status: string
  processing_error?: string | null
  updated_at: string
}

export const ACCEPTED_FILE_TYPES =
  ".pdf,.docx,.txt,.md,.csv,.xlsx,.pptx"

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** exponent

  return `${value.toFixed(exponent === 0 || value >= 10 ? 0 : 1)} ${units[exponent]}`
}

export async function fetchDocuments(): Promise<WorkspaceDocument[]> {
  const response = await fetch(DOCUMENTS_URL)

  if (!response.ok) {
    throw new Error(`Failed to load documents (${response.status})`)
  }

  const data: WorkspaceDocument[] = await response.json()

  return [...data].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export async function uploadDocument(file: File): Promise<WorkspaceDocument> {
  const formData = new FormData()
  formData.append("workspace_id", WORKSPACE_ID)
  formData.append("file", file)

  const response = await fetch(DOCUMENTS_URL, {
    method: "POST",
    body: formData,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || `Upload failed (${response.status})`)
  }

  return data as WorkspaceDocument
}

/** Poll until the document is ready or failed (or we give up). */
export async function waitForProcessing(
  documentId: string,
  timeoutMs = 10 * 60 * 1000,
): Promise<WorkspaceDocument | null> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const documents = await fetchDocuments().catch(() => null)
    const document = documents?.find((item) => item.id === documentId)

    if (!documents) continue
    if (!document) return null

    const status = document.processing_status.toLowerCase()
    if (status === "ready" || status === "failed") return document
  }

  return null
}

/** Ready documents, newest first. Change `refreshKey` to reload. */
export function useRecentDocuments(refreshKey = 0) {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([])

  useEffect(() => {
    let cancelled = false

    fetchDocuments()
      .then((data) => {
        if (!cancelled) {
          setDocuments(
            data.filter(
              (item) => item.processing_status.toLowerCase() === "ready",
            ),
          )
        }
      })
      .catch(() => {
        // The list is decorative here; pages that need it show their own error.
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return documents
}
