// Shared SVG pieces: the theme-aware text and track styles, the document wrapper, and the segmented task track
// that both the band and the panel draw.

import type { Segment } from '../core/flow'
import { ACCENT } from '../core/palette'
import { colorOf } from '../core/roles'
import { SYMBOL_CSS } from './symbols'

export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif"
export const TROUBLE = '#d9534f'
export const OK = '#3b9c5f'

// `tx` text, `mu` muted text, `m` the mark's quiet bars, `tr` an empty track, `ln` a divider.
const BASE_CSS = `<style>
.tx{fill:#1d1f24}.mu{fill:#6e737c}.m{fill:#8d929a}.tr{fill:#e6e7ea}.ln{stroke:#e9eaed}
@media (prefers-color-scheme: dark){.tx{fill:#eceef2}.mu{fill:#a0a5ad}.m{fill:#a0a5ad}.tr{fill:#30333a}.ln{stroke:#2b2e34}}
.pulse{animation:pulse 1s ease-in-out infinite}@keyframes pulse{50%{opacity:.45}}
@media (prefers-reduced-motion: reduce){.pulse{animation:none}}
</style>`

export const doc = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${BASE_CSS}${SYMBOL_CSS}${body}</svg>`

export const text = (x: number, y: number, s: string, size: number, cls: string, extra = ''): string =>
  `<text class="${cls}" x="${x}" y="${y}" font-family="${FONT}" font-size="${size}"${extra ? ` ${extra}` : ''}>${s}</text>`

const segmentFill = (seg: Segment): { fill: string; opacity: number; cls: string } => {
  const color = seg.role === 'other' ? ACCENT : colorOf(seg.role)
  switch (seg.state) {
    case 'accepted':
      return { fill: color, opacity: 1, cls: '' }
    case 'delivered':
      return { fill: color, opacity: 0.5, cls: '' }
    case 'active':
      return { fill: color, opacity: 0.85, cls: 'pulse' }
    case 'trouble':
      return { fill: TROUBLE, opacity: 0.9, cls: '' }
    default:
      return { fill: '', opacity: 1, cls: '' }
  }
}

/**
 * The task track: one rounded segment per task, coloured by its role and state. Too many tasks for the width
 * collapse into one bar filled to `share`.
 */
export const track = (x: number, y: number, w: number, h: number, segments: readonly Segment[], share: number): string => {
  const radius = h / 2
  if (segments.length === 0 || w / segments.length < 5) {
    const filled = Math.round(w * share)
    return `<rect class="tr" x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}"/>${
      filled > 0 ? `<rect x="${x}" y="${y}" width="${filled}" height="${h}" rx="${radius}" fill="${ACCENT}"/>` : ''
    }`
  }
  const gap = w / segments.length > 14 ? 3 : 1.5
  const segW = (w - gap * (segments.length - 1)) / segments.length
  return segments
    .map((seg, i) => {
      const f = segmentFill(seg)
      const sx = (x + i * (segW + gap)).toFixed(2)
      const paint = f.fill ? ` fill="${f.fill}" fill-opacity="${f.opacity}"` : ''
      const cls = [f.cls, f.fill ? '' : 'tr'].filter(Boolean).join(' ')
      return `<rect${cls ? ` class="${cls}"` : ''} x="${sx}" y="${y}" width="${segW.toFixed(2)}" height="${h}" rx="${Math.min(radius, segW / 2).toFixed(2)}"${paint}/>`
    })
    .join('')
}
