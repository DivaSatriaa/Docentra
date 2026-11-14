import { ExternalLink, FileWarning, Quote, X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import * as pdfjs from "pdfjs-dist"
import type { PDFDocumentProxy } from "pdfjs-dist"

import FileTypeIcon from "../common/FileTypeIcon"
import { documentFileUrl } from "../../lib/api"
import { clearHighlights, highlightPhrases } from "../../lib/highlight"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString()

export type ViewerSource = {
  /** Changes on every click, so re-opening the same source scrolls again. */
  key: string
  source: number
  document_id: string
  document_name: string
  page: number
  snippet: string
  highlights?: string[]
}

type Status = "loading" | "ready" | "error"

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase()
}

function phrasesOf(source: ViewerSource) {
  const list = (source.highlights ?? []).filter((h) => h.trim())
  if (list.length > 0) return list
  // Older answers have only a snippet: strip the "..." it may carry.
  return source.snippet
    .split(/\s*(?:…|\.\.\.)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Scroll the first highlight into the middle of the scroll container. */
function revealMark(marks: HTMLElement[], fallback?: HTMLElement | null) {
  const target = marks[0] ?? fallback
  if (!target) return
  target.scrollIntoView({ behavior: "smooth", block: marks[0] ? "center" : "start" })
  for (const mark of marks) {
    mark.classList.remove("src-hl-pulse")
    // Restart the pulse animation.
    void mark.offsetWidth
    mark.classList.add("src-hl-pulse")
  }
}

export default function SourceViewer({
  source,
  onClose,
}: {
  source: ViewerSource
  onClose: () => void
}) {
  const extension = extensionOf(source.document_name)
  const fileUrl = documentFileUrl(source.document_id)
  const phrases = phrasesOf(source)
  // Whether the cited passage was located, per citation click.
  const [result, setResult] = useState<{ key: string; found: boolean } | null>(null)
  const found = result?.key === source.key ? result.found : null
  const setFound = (value: boolean) => setResult({ key: source.key, found: value })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <aside
      aria-label="Source viewer"
      className="fixed inset-0 z-40 flex animate-fade-in flex-col bg-ink-900 lg:static lg:z-auto lg:w-[min(46vw,720px)] lg:shrink-0 lg:border-l lg:border-white/[0.07]"
    >
      <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-md bg-brand-500/25 px-1.5 text-[11px] font-semibold text-brand-300">
          {source.source}
        </span>
        <FileTypeIcon type={extension} size={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white/85">
            {source.document_name}
          </p>
          {extension === "pdf" && (
            <p className="text-[11px] text-white/35">Page {source.page}</p>
          )}
        </div>
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          title="Open file in a new tab"
          aria-label="Open file in a new tab"
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ExternalLink size={15} />
        </a>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close source viewer"
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X size={16} />
        </button>
      </header>

      {phrases.length > 0 && (
        <div className="border-b border-white/[0.07] bg-white/[0.015] px-4 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/35">
            <Quote size={11} />
            Cited passage
            {found === false && (
              <span className="normal-case tracking-normal text-amber-300/70">
                · exact spot not found, showing page {source.page}
              </span>
            )}
          </p>
          <p className="line-clamp-3 text-[12px] leading-5 text-white/60">
            {phrases.join(" … ")}
          </p>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {extension === "pdf" ? (
          <PdfView
            key={source.document_id}
            url={fileUrl}
            source={source}
            phrases={phrases}
            onFound={setFound}
          />
        ) : extension === "docx" ? (
          <DocxView
            key={source.document_id}
            url={fileUrl}
            source={source}
            phrases={phrases}
            onFound={setFound}
          />
        ) : ["txt", "md", "csv"].includes(extension) ? (
          <TextView
            key={source.document_id}
            url={fileUrl}
            source={source}
            phrases={phrases}
            onFound={setFound}
          />
        ) : (
          <Unsupported url={fileUrl} extension={extension} />
        )}
      </div>
    </aside>
  )
}

type ViewProps = {
  url: string
  source: ViewerSource
  phrases: string[]
  onFound: (found: boolean) => void
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-[13px] text-white/40">
      {children}
    </div>
  )
}

function LoadError({ url }: { url: string }) {
  return (
    <Centered>
      <FileWarning size={22} className="text-white/30" />
      Couldn't load this file.
      <a href={url} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">
        Open it in a new tab
      </a>
    </Centered>
  )
}

// ---------------------------------------------------------------- PDF

/**
 * Draws one page (canvas + selectable text layer) into `host`. Imperative on
 * purpose: React-managed text layers get redrawn on every parent render,
 * which wipes the highlight marks.
 */
async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  host: HTMLElement,
  cssWidth: number,
  isCancelled: () => boolean,
) {
  const page = await pdf.getPage(pageNumber)
  if (isCancelled()) return

  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: cssWidth / base.width })
  const ratio = window.devicePixelRatio || 1

  host.style.setProperty("--total-scale-factor", String(viewport.scale))
  host.style.width = `${Math.floor(viewport.width)}px`
  host.style.height = `${Math.floor(viewport.height)}px`

  const canvas = document.createElement("canvas")
  canvas.width = Math.floor(viewport.width * ratio)
  canvas.height = Math.floor(viewport.height * ratio)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  canvas.className = "block"

  const textLayer = document.createElement("div")
  textLayer.className = "textLayer"

  host.replaceChildren(canvas, textLayer)

  const context = canvas.getContext("2d")
  if (!context) return
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
  }).promise
  if (isCancelled()) return

  await new pdfjs.TextLayer({
    textContentSource: page.streamTextContent(),
    container: textLayer,
    viewport,
  }).render()
}

function PdfView({ url, source, phrases, onFound }: ViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const width = useWidth(scrollRef)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  // Bumped after every full render, so highlighting re-runs on resize.
  const [renderVersion, setRenderVersion] = useState(0)
  const pageWidth = Math.min(width - 24, 900)

  useEffect(() => {
    // Destroying the task rejects it with "Worker was destroyed" (not an
    // AbortException), e.g. on StrictMode's dev remount. Ignore anything a
    // cancelled task reports, or it flips the view to "error" and back.
    let cancelled = false
    const task = pdfjs.getDocument(url)
    task.promise.then(
      (doc) => {
        if (cancelled) return
        setPdf(doc)
        setStatus("ready")
      },
      (error) => {
        if (cancelled) return
        console.error("Failed to load PDF:", error)
        setStatus("error")
      },
    )
    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [url])

  // Draw every page, the cited one first so it's ready to highlight soonest.
  useEffect(() => {
    const container = pagesRef.current
    if (!pdf || !container || pageWidth <= 0) return

    let cancelled = false
    const isCancelled = () => cancelled

    const hosts = Array.from({ length: pdf.numPages }, (_, i) => {
      const wrapper = document.createElement("div")
      wrapper.dataset.page = String(i + 1)
      wrapper.className =
        "pdf-page relative mx-auto mb-3 overflow-hidden rounded-md bg-white shadow-[0_8px_30px_-10px_rgba(0,0,0,0.7)]"
      // Placeholder size (A4 ratio) until the page is measured.
      wrapper.style.width = `${pageWidth}px`
      wrapper.style.height = `${Math.round(pageWidth * 1.414)}px`
      return wrapper
    })
    container.replaceChildren(...hosts)

    const first = Math.min(Math.max(source.page, 1), pdf.numPages)
    const order = [first, ...hosts.map((_, i) => i + 1).filter((n) => n !== first)]

    void (async () => {
      for (const n of order) {
        if (cancelled) return
        try {
          await renderPdfPage(pdf, n, hosts[n - 1], pageWidth, isCancelled)
        } catch (error) {
          if (!cancelled) console.error(`Failed to render PDF page ${n}:`, error)
        }
        // Highlight as soon as the cited page is ready.
        if (n === first && !cancelled) setRenderVersion((v) => v + 1)
      }
      if (!cancelled) setRenderVersion((v) => v + 1)
    })()

    return () => {
      cancelled = true
    }
    // The cited page only decides render order; don't redraw when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageWidth])

  const lastHighlight = useRef<string | null>(null)

  useEffect(() => {
    const root = pagesRef.current
    if (!pdf || !root || renderVersion === 0) return

    const targetPage = Math.min(Math.max(source.page, 1), pdf.numPages)
    const pageEl = root.querySelector<HTMLElement>(`[data-page="${targetPage}"]`)
    const allDrawn = [...root.querySelectorAll(".pdf-page")].every((p) =>
      p.querySelector(".textLayer"),
    )

    clearHighlights(root)
    let marks = pageEl ? highlightPhrases(pageEl, phrases) : []

    // Not on the cited page (page numbers can drift by one): search every
    // page once they're all drawn.
    if (marks.length === 0) {
      if (!allDrawn) return
      marks = highlightPhrases(root, phrases)
    }

    // Only scroll when a new citation was opened, not on every redraw.
    const isNew = lastHighlight.current !== source.key
    lastHighlight.current = source.key
    onFound(marks.length > 0)
    if (isNew) revealMark(marks, pageEl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderVersion, source.key, pdf])

  if (status === "error") return <LoadError url={url} />

  return (
    <div ref={scrollRef} className="pdf-view h-full overflow-y-auto bg-ink-950 px-3 py-4">
      {status === "loading" && <Centered>Loading document...</Centered>}
      <div ref={pagesRef} />
    </div>
  )
}

// ---------------------------------------------------------------- DOCX

function DocxView({ url, source, phrases, onFound }: ViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>("loading")

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const [{ renderAsync }, response] = await Promise.all([
          import("docx-preview"),
          fetch(url),
        ])
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.arrayBuffer()
        if (cancelled || !bodyRef.current) return

        await renderAsync(data, bodyRef.current, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          experimental: true,
        })
        if (!cancelled) setStatus("ready")
      } catch (error) {
        console.error("Failed to render DOCX:", error)
        if (!cancelled) setStatus("error")
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [url])

  // Scale fixed-width Word pages down to fit the panel.
  const width = useWidth(scrollRef)
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (status !== "ready" || !body || width === 0) return
    body.querySelectorAll<HTMLElement>("section.docx").forEach((page) => {
      page.style.zoom = "1"
      const zoom = Math.min(1, (width - 24) / page.offsetWidth)
      page.style.zoom = String(zoom)
    })
  }, [status, width])

  useEffect(() => {
    const body = bodyRef.current
    if (status !== "ready" || !body) return
    clearHighlights(body)
    const marks = highlightPhrases(body, phrases)
    onFound(marks.length > 0)
    revealMark(marks, body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source.key])

  return (
    <div ref={scrollRef} className="docx-view h-full overflow-y-auto bg-ink-950">
      {status === "loading" && <Centered>Loading document...</Centered>}
      {status === "error" && <LoadError url={url} />}
      <div ref={bodyRef} className={status === "error" ? "hidden" : ""} />
    </div>
  )
}

// ---------------------------------------------------------------- Text

function TextView({ url, source, phrases, onFound }: ViewProps) {
  const preRef = useRef<HTMLPreElement>(null)
  const [status, setStatus] = useState<Status>("loading")

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.text()
      })
      .then((text) => {
        if (cancelled || !preRef.current) return
        // Set outside React so the highlight marks aren't re-rendered away.
        preRef.current.textContent = text
        setStatus("ready")
      })
      .catch((error) => {
        console.error("Failed to load text file:", error)
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    const pre = preRef.current
    if (status !== "ready" || !pre) return
    clearHighlights(pre)
    const marks = highlightPhrases(pre, phrases)
    onFound(marks.length > 0)
    revealMark(marks, pre)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source.key])

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      {status === "loading" && <Centered>Loading document...</Centered>}
      {status === "error" && <LoadError url={url} />}
      <pre
        ref={preRef}
        className={[
          "whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-white/75",
          status === "ready" ? "" : "hidden",
        ].join(" ")}
      />
    </div>
  )
}

function Unsupported({ url, extension }: { url: string; extension: string }) {
  return (
    <Centered>
      <FileWarning size={22} className="text-white/30" />
      <span>
        In-app preview isn't available for {extension ? `.${extension}` : "this"} files yet.
        The cited passage is shown above.
      </span>
      <a href={url} target="_blank" rel="noreferrer" className="text-brand-300 hover:underline">
        Open the file
      </a>
    </Centered>
  )
}
