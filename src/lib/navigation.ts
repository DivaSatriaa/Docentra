export type Page = "chat" | "documents" | "collections" | "history" | "settings"

export const PAGE_TITLES: Record<Page, string> = {
  chat: "Chat",
  documents: "Documents",
  collections: "Collections",
  history: "History",
  settings: "Settings",
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

/** Label for the platform's shortcut modifier key. */
export const MOD_KEY = isMac ? "⌘" : "Ctrl"
