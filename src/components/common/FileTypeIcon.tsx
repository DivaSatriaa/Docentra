/**
 * File-type glyph drawn in the app's own palette: a page with a folded corner,
 * tinted per type so PDF / Word / sheets stay distinguishable at a glance.
 * From 22px up it also carries the extension label.
 */

type Kind = { color: string; label: string }

const KINDS: Record<string, Kind> = {
  pdf: { color: "var(--color-file-pdf)", label: "PDF" },
  doc: { color: "var(--color-file-doc)", label: "DOC" },
  docx: { color: "var(--color-file-doc)", label: "DOC" },
  xlsx: { color: "var(--color-file-sheet)", label: "XLS" },
  csv: { color: "var(--color-file-csv)", label: "CSV" },
  pptx: { color: "var(--color-file-slides)", label: "PPT" },
  md: { color: "var(--color-file-md)", label: "MD" },
  txt: { color: "var(--color-file-text)", label: "TXT" },
}

const FALLBACK: Kind = { color: "var(--color-file-text)", label: "" }

interface FileTypeIconProps {
  type: string
  size?: number
  className?: string
}

export default function FileTypeIcon({
  type,
  size = 32,
  className = "",
}: FileTypeIconProps) {
  const key = type.toLowerCase().replace(".", "")
  const kind = KINDS[key] ?? FALLBACK
  const labelled = size >= 22 && kind.label !== ""

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={kind.label ? `${key.toUpperCase()} file` : "File"}
      className={`shrink-0 ${className}`}
      style={{ color: kind.color }}
    >
      {/* Page */}
      <path
        d="M9 3h10.2a2 2 0 0 1 1.4.6l5.8 5.8a2 2 0 0 1 .6 1.4V26a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"
        fill="currentColor"
        fillOpacity={labelled ? 0.16 : 0.24}
        stroke="currentColor"
        strokeOpacity={0.75}
        strokeWidth={labelled ? 1.3 : 2}
        strokeLinejoin="round"
      />
      {/* Folded corner */}
      <path
        d="M19.5 3.4V8a2.5 2.5 0 0 0 2.5 2.5h4.6"
        stroke="currentColor"
        strokeOpacity={0.75}
        strokeWidth={labelled ? 1.3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {labelled ? (
        <text
          x="16.5"
          y="23.2"
          textAnchor="middle"
          fontSize={kind.label.length > 2 ? 7.4 : 8.4}
          fontWeight={700}
          letterSpacing="0.2"
          fill="currentColor"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {kind.label}
        </text>
      ) : (
        <path
          d="M11 17h10M11 21.5h6.5"
          stroke="currentColor"
          strokeOpacity={0.9}
         
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
