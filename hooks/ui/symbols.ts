// Crew symbols: one tile per role, the role's colour tinting the tile and drawing its glyph.
// The builder's three rising bars and the band's mark echo the Crypto Gameplan logo (brand/mark.svg).
// Motion is pure CSS, run by the compositor; periods divide one second so the once-a-second redraw
// of a running row restarts them in phase.

import { ACCENT } from '../core/palette'
import { colorOf } from '../core/roles'

const SYMBOL_SIZE = 30

export const SYMBOL_CSS = `<style>
.run g,.run rect,.run path,.run circle{transform-box:fill-box}
.s-architect.run .gl{transform-origin:50% 0;animation:sway 1s ease-in-out infinite}
@keyframes sway{25%{transform:rotate(9deg)}75%{transform:rotate(-9deg)}}
.s-investigator.run .gl{animation:scan 1s ease-in-out infinite}
.s-investigator.run .gt{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1.5px,1px)}50%{transform:translate(0,2px)}75%{transform:translate(1.5px,1px)}}
.s-engineer.run .gl{transform-origin:50% 50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(45deg)}}
.s-builder.run .b{transform-origin:50% 100%;animation:rise .5s ease-in-out infinite alternate}
.s-builder.run .b2{animation-delay:-.17s}.s-builder.run .b3{animation-delay:-.33s}
@keyframes rise{from{transform:scaleY(.55)}to{transform:scaleY(1)}}
.s-runner.run .gl{animation:dash .5s ease-in-out infinite}
.s-runner.run .sp{animation:blink .25s steps(1) infinite}
@keyframes dash{50%{transform:translateX(1.5px)}}
.s-explore.run .nd{transform-origin:50% 50%;animation:seek 1s ease-in-out infinite}
@keyframes seek{25%{transform:rotate(30deg)}75%{transform:rotate(-30deg)}}
.s-other.run .d{animation:blink 1s steps(1) infinite}.s-other.run .d2{animation-delay:-.67s}.s-other.run .d3{animation-delay:-.33s}
@keyframes blink{50%{opacity:.2}}
.mk.run .b{transform-origin:50% 100%;animation:rise .5s ease-in-out infinite alternate}
.mk.run .b2{animation-delay:-.17s}.mk.run .b3{animation-delay:-.33s}
@media (prefers-reduced-motion: reduce){.run,.run g,.run path,.run rect,.run circle{animation:none!important}}
</style>`

// Glyphs on a 24-unit grid, stroked in the role colour unless they fill themselves.
const GLYPHS: Record<string, (c: string) => string> = {
  // Architect: a drafting compass; it sways from its hinge.
  architect: c =>
    `<g class="gl"><circle cx="12" cy="4.5" r="1.8" fill="${c}" stroke="none"/><path d="M12 6.3 7 19.5M12 6.3l5 13.2M8.4 15.4h7.2"/></g>`,
  // Investigator: a magnifier sweeping the code; the glint blinks.
  investigator: () =>
    `<g class="gl"><circle cx="10.5" cy="10.5" r="5.8"/><path d="M14.8 14.8 19.8 19.8"/><path class="gt" d="M7.6 9.6a3 3 0 0 1 2.4-2.3" stroke-width="1.5"/></g>`,
  // Engineer: a gear that turns.
  engineer: () => {
    const teeth = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4
      const p = (r: number) => `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`
      return `M${p(6.4)}L${p(9.2)}`
    }).join('')
    return `<g class="gl"><path d="${teeth}" stroke-width="3.4" stroke-linecap="butt"/><circle cx="12" cy="12" r="4.3" stroke-width="3.8"/></g>`
  },
  // Builder: three rising bars, the CGP mark's own shape; they build up in turn.
  builder: c =>
    `<g fill="${c}" stroke="none"><rect class="b b1" x="4" y="14" width="4.4" height="6" rx="1.3"/><rect class="b b2" x="9.8" y="9.5" width="4.4" height="10.5" rx="1.3"/><rect class="b b3" x="15.6" y="4" width="4.4" height="16" rx="1.3"/></g>`,
  // Runner: a bolt with speed lines; it darts forward.
  runner: c =>
    `<path class="sp" d="M2.5 9.5h2.6M1.5 13.5h3.2"/><g class="gl"><path d="M13.6 3 6.2 13.4h5L10.2 21l7.8-10.8h-5.1z" fill="${c}" stroke="none"/></g>`,
  // Explore (Claude Code's own scout): a compass whose needle seeks.
  explore: c =>
    `<circle cx="12" cy="12" r="8.4"/><g class="nd"><path d="M12 6.2 14 12l-2 5.8L10 12z" fill="${c}" stroke="none"/></g>`,
  // Any other subagent: three dots.
  other: c =>
    `<g fill="${c}" stroke="none"><circle class="d d1" cx="6.5" cy="12" r="2"/><circle class="d d2" cx="12" cy="12" r="2"/><circle class="d d3" cx="17.5" cy="12" r="2"/></g>`,
}

/** The tile for `role` at (x, y), `size` px square; `dim` for planned tasks, `isRunning` animates it. */
export const symbol = (x: number, y: number, role: string, dim = false, isRunning = false, size = SYMBOL_SIZE): string => {
  const key = role in GLYPHS ? role : 'other'
  const c = colorOf(key)
  const glyph = (GLYPHS[key] ?? GLYPHS.other ?? (() => ''))(c)
  return `<g transform="translate(${x},${y}) scale(${size / SYMBOL_SIZE})" opacity="${dim ? 0.45 : 1}"><g class="s-${key}${isRunning ? ' run' : ''}">\
<rect x="0.5" y="0.5" width="29" height="29" rx="8" fill="${c}" fill-opacity="0.14" stroke="${c}" stroke-opacity="0.35"/>\
<g transform="translate(3,3)" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></g></g>`
}

// The CGP mark's three bars, redrawn on a 20-unit square: two in the text tone (`m`), the tallest in gold.
/** The band's mark at (x, y), `size` px square; the bars build up while workers run. */
export const mark = (x: number, y: number, isRunning = false, size = 20): string =>
  `<g transform="translate(${x},${y}) scale(${size / 20})"><g class="mk${isRunning ? ' run' : ''}">\
<path class="m b b1" d="M0 20A5.8 5.2 0 0 1 5.8 14.8V20Z"/>\
<path class="m b b2" d="M7.64 20V9.56a2.3 2.3 0 0 1 2.3-2.3h3.04V20Z"/>\
<path class="b b3" fill="${ACCENT}" d="M14.66 20V2.3A2.3 2.3 0 0 1 16.96 0H20v19.4a.6.6 0 0 1-.6.6Z"/></g></g>`
