/**
 * Find passages of text inside rendered DOM (a PDF text layer, a rendered
 * DOCX, plain text) and wrap them in <mark class="src-hl">.
 *
 * Matching ignores case, whitespace and punctuation, because the text the AI
 * service extracted (pypdf, python-docx) never has exactly the same spacing,
 * line breaks or hyphenation as what the browser renders.
 */

const MARK_CLASS = "src-hl"
const KEEP = /[\p{L}\p{N}]/u
const MIN_MATCH = 12

type CharRef = { node: Text; offset: number }
type TextIndex = { text: string; refs: CharRef[] }

function normalizeChar(char: string): string {
  if (!KEEP.test(char)) return ""
  // Drop accents so "é" matches "e".
  return char.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
}

export function normalizeText(text: string): string {
  let out = ""
  for (const char of text) out += normalizeChar(char)
  return out
}

function buildIndex(root: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest("script, style")) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let text = ""
  const refs: CharRef[] = []

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text
    const data = textNode.data
    for (let i = 0; i < data.length; i++) {
      const normalized = normalizeChar(data[i])
      for (const piece of normalized) {
        text += piece
        refs.push({ node: textNode, offset: i })
      }
    }
  }

  return { text, refs }
}

/** [start, end) in the normalized index, or null. */
function locate(index: TextIndex, phrase: string): [number, number] | null {
  const needle = normalizeText(phrase)
  if (needle.length < Math.min(MIN_MATCH, 4)) return null

  const exact = index.text.indexOf(needle)
  if (exact !== -1) return [exact, exact + needle.length]

  // Extraction differences (a dropped word, a ligature) break exact matching:
  // fall back to the longest piece of the phrase that does match.
  for (const size of [120, 80, 50, 30, 20]) {
    if (needle.length <= size) continue
    const step = Math.max(8, Math.floor(size / 2))
    for (let start = 0; start + size <= needle.length; start += step) {
      const piece = needle.slice(start, start + size)
      const at = index.text.indexOf(piece)
      if (at !== -1) return [at, at + size]
    }
  }

  return null
}

function wrap(index: TextIndex, [start, end]: [number, number]): HTMLElement[] {
  // Group the matched characters by text node, in document order.
  const groups = new Map<Text, { from: number; to: number }>()
  for (let i = start; i < end; i++) {
    const { node, offset } = index.refs[i]
    const group = groups.get(node)
    if (group) group.to = Math.max(group.to, offset)
    else groups.set(node, { from: offset, to: offset })
  }

  const marks: HTMLElement[] = []

  for (const [node, { from, to }] of groups) {
    const middle = from > 0 ? node.splitText(from) : node
    if (to - from + 1 < middle.data.length) middle.splitText(to - from + 1)

    const mark = document.createElement("mark")
    mark.className = MARK_CLASS
    middle.parentNode?.insertBefore(mark, middle)
    mark.appendChild(middle)
    marks.push(mark)
  }

  return marks
}

export function clearHighlights(root: HTMLElement) {
  root.querySelectorAll(`mark.${MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

/**
 * Highlight every phrase found inside `root`. Returns the marks created, in
 * document order (the first one is where the viewer should scroll).
 */
export function highlightPhrases(root: HTMLElement, phrases: string[]): HTMLElement[] {
  const marks: HTMLElement[] = []

  for (const phrase of phrases) {
    // Re-index after each wrap: splitting text nodes invalidates the old one.
    const index = buildIndex(root)
    const range = locate(index, phrase)
    if (range) marks.push(...wrap(index, range))
  }

  return marks.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
}
