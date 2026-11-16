/** What happened with the web search, when one was requested. */
export type WebStatus = {
  used: boolean
  status: "ok" | "unavailable" | "no_results"
  /** Keywords sent to the search provider. */
  query: string
  /** Address the user put in the question, and the one actually read. */
  requested_url?: string
  used_url?: string | null
}

export type Citation = {
  source?: number
  /** Missing on older messages: a document. */
  kind?: "document" | "web"
  /** Web sources only. */
  url?: string
  title?: string
  document_id: string
  document_name: string
  page: number
  chunk_id: string
  snippet: string
  /** Exact passages the answer relied on, highlighted in the viewer. */
  highlights?: string[]
}

export type StreamDonePayload = {
  answer: string
  citations: Citation[]
  search_query: string
  scope: string[]
  web?: WebStatus
  message_id?: string
}

export type StreamHandlers = {
  onDelta(text: string): void
  onDone(payload: StreamDonePayload): void
}

export type SseEvent = { event: string; data: string }

const FRAME_BREAK = /\r?\n\r?\n/

/** Strip the single optional space after the field colon. */
function fieldValue(line: string, name: string): string {
  const value = line.slice(name.length + 1)
  return value.startsWith(" ") ? value.slice(1) : value
}

/**
 * Split complete SSE frames (terminated by a blank line) out of `buffer`.
 * The unfinished trailing frame is returned as `rest`.
 */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  let rest = buffer
  for (;;) {
    const match = FRAME_BREAK.exec(rest)
    if (!match) break
    const frame = rest.slice(0, match.index)
    rest = rest.slice(match.index + match[0].length)

    let event = ""
    const data: string[] = []
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith(":")) continue
      if (line.startsWith("event:")) event = fieldValue(line, "event")
      else if (line.startsWith("data:")) data.push(fieldValue(line, "data"))
    }
    if (!event && data.length === 0) continue
    events.push({ event: event || "message", data: data.join("\n") })
  }
  return { events, rest }
}

function parseJson<T>(data: string, name: string): T {
  try {
    return JSON.parse(data) as T
  } catch {
    throw new Error(`invalid ${name} event payload`)
  }
}

/**
 * POST `body` as JSON to `url` and consume the SSE response, forwarding
 * `delta` and `done` events. Resolves after `done`; rejects on HTTP errors,
 * `error` events, a truncated stream, or abort (native AbortError).
 */
export async function streamMessage(
  url: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `Request failed with ${res.status}`)
  }
  if (!res.body) throw new Error("stream ended unexpectedly")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  // Returns true once a terminal `done` event has been handled.
  const dispatch = (events: SseEvent[]): boolean => {
    for (const ev of events) {
      if (ev.event === "delta") {
        handlers.onDelta(parseJson<{ text: string }>(ev.data, "delta").text)
      } else if (ev.event === "done") {
        handlers.onDone(parseJson<StreamDonePayload>(ev.data, "done"))
        return true
      } else if (ev.event === "error") {
        let message = ev.data
        try {
          const parsed = JSON.parse(ev.data) as { message?: unknown }
          if (typeof parsed.message === "string" && parsed.message) message = parsed.message
        } catch {
          // keep raw data as the message
        }
        throw new Error(message || "stream error")
      }
    }
    return false
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        // Treat a final unterminated frame as complete.
        const parsed = parseSse(buffer + "\n\n")
        if (dispatch(parsed.events)) return
        throw new Error("stream ended unexpectedly")
      }
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSse(buffer)
      buffer = parsed.rest
      if (dispatch(parsed.events)) return
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}
