import { API_V1, WORKSPACE_URL } from "./api"
import type { WorkspaceDocument } from "./documents"

export type Collection = {
  id: string
  name: string
  description?: string | null
  document_count: number
  updated_at: string
}

export type CollectionDetail = Collection & { documents: WorkspaceDocument[] }

/** A collection picked as the scope of a chat question. */
export type CollectionScope = { id: string; name: string }

const COLLECTIONS_URL = `${WORKSPACE_URL}/collections`

function collectionUrl(id: string) {
  return `${API_V1}/collections/${encodeURIComponent(id)}`
}

/** Resolves with the JSON body, or rejects with the backend's error text. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || `Request failed (${response.status})`)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

export function fetchCollections(): Promise<Collection[]> {
  return request(COLLECTIONS_URL)
}

export function fetchCollection(id: string): Promise<CollectionDetail> {
  return request(collectionUrl(id))
}

export function createCollection(input: {
  name: string
  description?: string
}): Promise<Collection> {
  return request(COLLECTIONS_URL, jsonBody("POST", input))
}

export function updateCollection(
  id: string,
  input: { name?: string; description?: string },
): Promise<Collection> {
  return request(collectionUrl(id), jsonBody("PATCH", input))
}

export function deleteCollection(id: string): Promise<void> {
  return request(collectionUrl(id), { method: "DELETE" })
}

export function addCollectionDocuments(
  id: string,
  documentIds: string[],
): Promise<CollectionDetail> {
  return request(
    `${collectionUrl(id)}/documents`,
    jsonBody("POST", { document_ids: documentIds }),
  )
}

export function removeCollectionDocument(
  id: string,
  documentId: string,
): Promise<void> {
  return request(
    `${collectionUrl(id)}/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  )
}

export function documentCountLabel(count: number) {
  return `${count} document${count === 1 ? "" : "s"}`
}
