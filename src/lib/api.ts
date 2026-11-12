/** Shared backend settings. Override with VITE_API_BASE_URL / VITE_WORKSPACE_ID. */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

export const WORKSPACE_ID: string =
  import.meta.env.VITE_WORKSPACE_ID ?? "5400fe40-1e5a-4d63-9ffe-06fb12621540"

export const API_V1 = `${API_BASE_URL}/api/v1`
export const WORKSPACE_URL = `${API_V1}/workspaces/${WORKSPACE_ID}`
export const CONVERSATIONS_URL = `${WORKSPACE_URL}/conversations`

export type Conversation = {
  id: string
  workspace_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export function conversationTitle(conversation: Pick<Conversation, "title">) {
  return conversation.title?.trim() || "New Chat"
}

function byNewest(a: Conversation, b: Conversation) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
}

export async function fetchConversations(): Promise<Conversation[]> {
  const response = await fetch(CONVERSATIONS_URL)
  if (!response.ok) {
    throw new Error(`Failed to load chats (${response.status})`)
  }
  const data: Conversation[] = await response.json()
  return [...data].sort(byNewest)
}

export async function createConversation(): Promise<Conversation> {
  const response = await fetch(CONVERSATIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "New Chat" }),
  })
  if (!response.ok) {
    throw new Error(`Failed to create chat (${response.status})`)
  }
  return response.json()
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_V1}/conversations/${id}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(
      (await response.text()) || `Failed to delete chat (${response.status})`,
    )
  }
}

/** "Today", "Yesterday", "Previous 7 days", "Previous 30 days", or "Month Year". */
export function dateGroupLabel(dateString: string, now = new Date()) {
  const date = new Date(dateString)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((startOfToday.getTime() - date.getTime()) / dayMs) + 1

  if (date >= startOfToday) return "Today"
  if (diffDays <= 1) return "Yesterday"
  if (diffDays <= 7) return "Previous 7 days"
  if (diffDays <= 30) return "Previous 30 days"
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

/** Groups items (already sorted newest first) by `dateGroupLabel`. */
export function groupByDate<T extends { updated_at: string }>(items: T[]) {
  const groups: { label: string; items: T[] }[] = []
  for (const item of items) {
    const label = dateGroupLabel(item.updated_at)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export function formatRelativeTime(dateString: string, now = Date.now()) {
  const seconds = Math.round((new Date(dateString).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return "just now"
}
