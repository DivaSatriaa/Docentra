import { ExternalLink, Globe2, Quote, X } from "lucide-react"
import { useEffect } from "react"

export type WebSource = {
  source: number
  url: string
  title: string
  site: string
  snippet: string
  highlights?: string[]
}

/**
 * Side panel for a web source: the passages the answer relied on, and a
 * button to open the page itself. The page is not embedded: most sites
 * refuse to be shown inside another page.
 */
export default function WebPreview({
  source,
  onClose,
}: {
  source: WebSource
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const passages = (
    source.highlights?.length ? source.highlights : [source.snippet]
  )
    .map((text) => text.trim())
    .filter(Boolean)

  return (
    <aside
      aria-label="Web source preview"
      className="fixed inset-0 z-40 flex animate-fade-in flex-col bg-ink-900 lg:static lg:z-auto lg:w-[min(46vw,720px)] lg:shrink-0 lg:border-l lg:border-white/[0.07]"
    >
      <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
        <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-md bg-brand-500/25 px-1.5 text-[11px] font-semibold text-brand-300">
          {source.source}
        </span>
        <Globe2 size={17} className="shrink-0 text-sky-300/80" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white/85">
            {source.title || source.site}
          </p>
          <p className="truncate text-[11px] text-white/35">{source.site}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close web source preview"
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <p className="mb-3 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/35">
          <Quote size={11} />
          {passages.length > 1 ? "Cited passages" : "Cited passage"}
        </p>

        {passages.length > 0 ? (
          <div className="space-y-3">
            {passages.map((passage, index) => (
              <blockquote
                key={index}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] leading-6 text-white/75"
              >
                {passage}
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-white/40">
            No passage was kept for this source.
          </p>
        )}

        <p className="mt-4 break-all text-[11.5px] leading-5 text-white/35">
          {source.url}
        </p>

        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 text-[12.5px] font-medium text-white/80 transition hover:border-white/[0.2] hover:bg-white/[0.07] hover:text-white"
        >
          <ExternalLink size={14} />
          Open page in a new tab
        </a>

        <p className="mt-3 text-[11.5px] leading-5 text-white/30">
          This preview shows only what the answer used from the page.
        </p>
      </div>
    </aside>
  )
}
