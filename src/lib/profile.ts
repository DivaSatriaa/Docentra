import { useSyncExternalStore } from "react"

/** The name shown in the sidebar and the greeting. Kept in this browser only. */
const NAME_KEY = "docentra.displayName"
export const DEFAULT_DISPLAY_NAME = "User"
export const MAX_DISPLAY_NAME = 40

const listeners = new Set<() => void>()

function read() {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() || DEFAULT_DISPLAY_NAME
  } catch {
    return DEFAULT_DISPLAY_NAME
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Other tabs changing the name.
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/** An empty name goes back to the default. */
export function setDisplayName(name: string) {
  const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME)
  try {
    if (trimmed) localStorage.setItem(NAME_KEY, trimmed)
    else localStorage.removeItem(NAME_KEY)
  } catch {
    // Storage unavailable: the name just won't stick.
  }
  listeners.forEach((listener) => listener())
}

export function useDisplayName() {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_DISPLAY_NAME)
}
