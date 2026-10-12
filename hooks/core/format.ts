// Formatting and text fitting shared by the band and the panel.

/** Escapes text for SVG. */
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)

// System UI fonts average about 0.55em per character; narrow and wide glyphs are corrected for.
const NARROW = /[ .,:;'!|il1()[\]{}ftj]/
const WIDE = /[A-Z@%MWmw]/
const glyphEm = (ch: string): number => (NARROW.test(ch) ? 0.3 : WIDE.test(ch) ? 0.74 : 0.56)

/** Rough rendered width of `s` at `size` px. */
export const measure = (s: string, size: number): number => [...s].reduce((w, ch) => w + glyphEm(ch) * size, 0)

/** `s` shortened with an ellipsis until it fits `maxWidth` px at `size`. */
export const fit = (s: string, size: number, maxWidth: number): string => {
  if (measure(s, size) <= maxWidth) return s
  const chars = [...s]
  while (chars.length > 1 && measure(chars.join('') + '…', size) > maxWidth) chars.pop()
  return chars.join('').trimEnd() + '…'
}

/** A task title reduced to what identifies it: case, punctuation and a leading "3." or "Task 3:" dropped. */
export const matchKey = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^\s*(?:task\s*)?#?\d+\s*[.):-]\s*/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

export const tokensText = (count: number): string => {
  if (count >= 1e6) return `${(count / 1e6).toFixed(count >= 1e7 ? 0 : 1)}M`
  if (count >= 1e3) return `${Math.round(count / 1e3)}k`
  return String(Math.round(count))
}

export const usdText = (usd: number): string => `$${usd >= 100 ? usd.toFixed(0) : usd >= 10 ? usd.toFixed(1) : usd.toFixed(2)}`

export const durationText = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
