// The crew panel: every subagent of the session (running, then finished) and the planned tasks nobody has
// picked up yet. Desktop draws each row as an SVG; the terminal draws the same rows in text.

import type { AgentRun, Flow, Panel } from '../../types'
import { segmentsOf, share, statusLine, upNext } from '../core/flow'
import { durationText, esc, fit, measure, tokensText, usdText } from '../core/format'
import { modelLabel } from '../core/models'
import { colorOf, runsOn, symbolOf } from '../core/roles'
import { contextShare, elapsedOf, progressOf, totalsOf, type Totals } from '../core/runs'
import { STATUS_WORD, T } from '../core/strings'
import { symbol } from './symbols'
import { doc, FONT, OK, text, track, TROUBLE } from './svg'

export const PANE = 'cgp-crew-panel'

/** What register.tsx hands the panel: the surface's elements, the state it read and the actions it owns. */
export type PaneDraw = {
  // From $.ui.resolve(e): the surface's own elements.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Box: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Text: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Svg?: any
  isDesktop: boolean
  columns: number
  flow: Flow | null
  runs: AgentRun[]
  panel: Panel
  at: number
  onToggleCompact: () => unknown
  onToggleFinished: () => unknown
}

const statusColor = (r: AgentRun): string =>
  r.status === 'running' ? colorOf(r.role === 'other' ? 'other' : r.role) : r.status === 'done' ? OK : r.status === 'failed' ? TROUBLE : ''

const summaryText = (t: Totals, count: number): string =>
  `≈${usdText(t.costUsd)} · ${tokensText(t.tokens)} ${T.tokens} · ${durationText(t.spanMs)} · ${count} ${T.workers}`

const metaOf = (r: AgentRun): string => {
  const parts = [modelLabel(r.model)]
  if (r.effort) parts.push(r.effort)
  if (r.round > 1) parts.push(`${T.round} ${r.round}`)
  return parts.join(' · ')
}

const statsOf = (r: AgentRun, at: number): string =>
  `ctx ${Math.round(contextShare(r) * 100)}% · ${tokensText(r.tokens)} · ≈${usdText(r.costUsd)} · ${durationText(elapsedOf(r, at))}`

// --- desktop

const HEAD_WITH_FLOW = 58
const HEAD_ONLY_SUMMARY = 20
const RUN_H = 62
const NEXT_H = 42

export const headSvg = (w: number, flow: Flow | null, runs: readonly AgentRun[], t: Totals): string => {
  if (!flow || flow.isFinished) return doc(w, HEAD_ONLY_SUMMARY, text(0, 14, esc(summaryText(t, runs.length)), 12, 'mu', 'font-variant-numeric="tabular-nums"'))
  const status = statusLine(flow, runs)
  return doc(
    w,
    HEAD_WITH_FLOW,
    `${text(0, 15, esc(fit(flow.title, 14, w - measure(status, 12) - 16)), 14, 'tx', 'font-weight="600"')}
${text(w, 15, esc(status), 12, 'mu', 'text-anchor="end"')}
${track(0, 26, w, 8, segmentsOf(flow, runs), share(flow))}
${text(0, 52, esc(summaryText(t, runs.length)), 12, 'mu', 'font-variant-numeric="tabular-nums"')}`,
  )
}

export const runSvg = (w: number, r: AgentRun, at: number): string => {
  const x = 42
  const textW = w - x
  const color = colorOf(r.role)
  const word = STATUS_WORD[r.status]
  const wordW = measure(word, 11) + 6
  const progress = progressOf(r)
  const barShare = progress ?? contextShare(r)
  const stats = statsOf(r, at)
  const steps = r.steps && r.steps.total > 0 ? `${r.steps.done}/${r.steps.total}${r.steps.note ? ` · ${r.steps.note}` : ''}` : ''
  const stepsRoom = textW - measure(stats, 11) - 14
  const sc = statusColor(r)
  return doc(
    w,
    RUN_H,
    `${symbol(2, 12, symbolOf(r.type), false, r.status === 'running')}
${text(x, 17, esc(fit(r.description || r.type, 13, textW - wordW - 8)), 13, 'tx', 'font-weight="600"')}
${text(w, 17, word, 11, r.status === 'running' ? 'pulse' : sc ? '' : 'mu', `text-anchor="end"${sc ? ` fill="${sc}"` : ''}`)}
<text x="${x}" y="33" font-size="11" font-family="${FONT}"><tspan fill="${color}" font-weight="600">${esc(r.role === 'other' ? r.type : r.role)}</tspan><tspan class="mu"> · ${esc(metaOf(r))}</tspan></text>
<rect class="tr" x="${x}" y="40" width="${textW}" height="4" rx="2"/>
<rect x="${x}" y="40" width="${Math.round(textW * barShare)}" height="4" rx="2"${progress === null ? ' class="m"' : ` fill="${color}"`}/>
${steps && stepsRoom > 40 ? text(x, 56, esc(fit(steps, 11, stepsRoom)), 11, 'tx') : ''}
${text(w, 56, esc(stats), 11, 'mu', 'text-anchor="end" font-variant-numeric="tabular-nums"')}
<line class="ln" x1="0" y1="${RUN_H - 0.5}" x2="${w}" y2="${RUN_H - 0.5}"/>`,
  )
}

export const nextSvg = (w: number, t: ReturnType<typeof upNext>[number]): string => {
  const x = 42
  const meta = [runsOn(t.role), t.after.length ? `${T.waitsFor} ${t.after.join(', ')}` : ''].filter(Boolean).join(' · ')
  return doc(
    w,
    NEXT_H,
    `${symbol(4, 8, t.role, true, false, 26)}
${text(x, 17, esc(fit(`${t.n}. ${t.title}`, 13, w - x)), 13, 'mu', 'font-weight="600"')}
<text x="${x}" y="33" font-size="11" font-family="${FONT}"><tspan fill="${colorOf(t.role)}" fill-opacity=".7">${esc(t.role)}</tspan><tspan class="mu">${meta ? ` · ${esc(meta)}` : ""}</tspan></text>
<line class="ln" x1="0" y1="${NEXT_H - 0.5}" x2="${w}" y2="${NEXT_H - 0.5}"/>`,
  )
}

export const compactSvg = (w: number, runs: readonly AgentRun[], next: ReturnType<typeof upNext>, t: Totals): string => {
  const icons = [
    ...runs.filter(r => r.status === 'running').map(r => ({ sym: symbolOf(r.type), dim: false, live: true })),
    ...runs.filter(r => r.status !== 'running').map(r => ({ sym: symbolOf(r.type), dim: false, live: false })),
    ...next.map(n => ({ sym: n.role, dim: true, live: false })),
  ]
  const summary = `≈${usdText(t.costUsd)} · ${tokensText(t.tokens)} · ${durationText(t.spanMs)}`
  const room = Math.max(1, Math.floor((w - measure(summary, 12) - 24) / 28))
  const shown = icons.slice(0, room)
  const more = icons.length - shown.length
  return doc(
    w,
    28,
    `${shown.map((ic, i) => symbol(i * 28, 2, ic.sym, ic.dim, ic.live, 24)).join('')}
${more > 0 ? text(shown.length * 28 + 2, 19, `+${more}`, 12, 'mu') : ''}
${text(w, 19, esc(summary), 12, 'mu', 'text-anchor="end" font-variant-numeric="tabular-nums"')}`,
  )
}

// --- terminal

const bar = (part: number, width: number): string => {
  const filled = Math.round(width * Math.max(0, Math.min(1, part)))
  return '━'.repeat(filled) + '─'.repeat(Math.max(0, width - filled))
}

const GLYPH: Record<AgentRun['status'], string> = { running: '●', done: '✓', failed: '✗', stopped: '■', ended: '○' }

export function paneTree(d: PaneDraw) {
  const { Box, Text, Button, runs, panel, at, flow } = d
  const running = runs.filter(r => r.status === 'running').reverse()
  const finished = runs.filter(r => r.status !== 'running').reverse()
  const next = upNext(flow, runs)
  const t = totalsOf(runs, at)
  const isEmpty = runs.length === 0 && next.length === 0

  const compactButton = <Button key="compact" label={panel.isCompact ? T.expand : T.compact} plain onPress={d.onToggleCompact} />
  const finishedButton = (
    <Button key="finished" label={`${panel.showFinished ? '▾' : '▸'} ${T.finished} · ${finished.length}`} plain onPress={d.onToggleFinished} />
  )

  if (d.isDesktop && d.Svg) {
    const Svg = d.Svg
    const w = Math.max(240, Math.min(900, d.columns * 8 - 8))
    const heading = (key: string, label: string) => (
      <Text key={key} dimColor>
        {label}
      </Text>
    )
    if (panel.isCompact) {
      return (
        <Box flexDirection="column" gap={1}>
          <Svg source={compactSvg(w, runs, next, t)} alt={summaryText(t, runs.length)} width={w} height={28} />
          {compactButton}
        </Box>
      )
    }
    const headH = flow && !flow.isFinished ? HEAD_WITH_FLOW : HEAD_ONLY_SUMMARY
    return (
      <Box flexDirection="column">
        <Svg source={headSvg(w, flow, runs, t)} alt={flow ? `${flow.title}: ${statusLine(flow, runs)}` : summaryText(t, runs.length)} width={w} height={headH} />
        {compactButton}
        {isEmpty && <Text dimColor>{T.noRuns}</Text>}
        {running.length > 0 && heading('h-running', `${T.running} · ${running.length}`)}
        {running.map(r => (
          <Svg key={r.key} source={runSvg(w, r, at)} alt={`${r.description}: ${r.role}, ${STATUS_WORD[r.status]}`} width={w} height={RUN_H} />
        ))}
        {finished.length > 0 && finishedButton}
        {panel.showFinished &&
          finished.map(r => (
            <Svg key={r.key} source={runSvg(w, r, at)} alt={`${r.description}: ${r.role}, ${STATUS_WORD[r.status]}`} width={w} height={RUN_H} />
          ))}
        {next.length > 0 && heading('h-next', `${T.planned} · ${next.length}`)}
        {next.map(n => (
          <Svg key={`next-${n.n}`} source={nextSvg(w, n)} alt={`${n.n}. ${n.title}: ${n.role}`} width={w} height={NEXT_H} />
        ))}
      </Box>
    )
  }

  const cols = Math.max(28, d.columns)
  const barW = Math.max(6, Math.min(18, cols - 40))
  const runRow = (r: AgentRun) => {
    const color = colorOf(r.role)
    const progress = progressOf(r)
    const steps = r.steps && r.steps.total > 0 ? `${r.steps.done}/${r.steps.total}${r.steps.note ? ` ${r.steps.note}` : ''} · ` : ''
    const glyphColor = r.status === 'failed' ? 'red' : r.status === 'done' ? 'green' : r.status === 'running' ? color : undefined
    return (
      <Box key={r.key} flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text color={glyphColor} dimColor={!glyphColor}>
            {GLYPH[r.status]}
          </Text>
          <Text bold wrap="truncate-end">
            {r.description || r.type}
          </Text>
        </Box>
        <Text wrap="truncate-end">
          {'  '}
          <Text color={color}>{r.role === 'other' ? r.type : r.role}</Text>
          <Text dimColor> · {metaOf(r)}</Text>
        </Text>
        <Text wrap="truncate-end">
          {'  '}
          {progress === null ? <Text dimColor>{bar(contextShare(r), barW)}</Text> : <Text color={color}>{bar(progress, barW)}</Text>}
          <Text dimColor>
            {' '}
            {steps}
            {statsOf(r, at)}
          </Text>
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold wrap="truncate-end">
          {flow && !flow.isFinished ? `${flow.title} · ${statusLine(flow, runs)}` : T.panelTitle}
        </Text>
        {compactButton}
      </Box>
      <Text dimColor wrap="truncate-end">
        {summaryText(t, runs.length)}
      </Text>
      {panel.isCompact ? (
        <Text wrap="truncate-end">
          {[...running, ...finished].map(r => (
            <Text key={r.key} color={r.status === 'running' ? colorOf(r.role) : undefined} dimColor={r.status !== 'running'}>
              {GLYPH[r.status]}{' '}
            </Text>
          ))}
          {next.map(n => (
            <Text key={`next-${n.n}`} dimColor>
              ○{' '}
            </Text>
          ))}
        </Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {isEmpty && <Text dimColor>{T.noRuns}</Text>}
          {running.length > 0 && (
            <Text dimColor>
              {T.running} · {running.length}
            </Text>
          )}
          {running.map(runRow)}
          {finished.length > 0 && finishedButton}
          {panel.showFinished && finished.map(runRow)}
          {next.length > 0 && (
            <Text dimColor>
              {T.planned} · {next.length}
            </Text>
          )}
          {next.map(n => (
            <Box key={`next-${n.n}`} flexDirection="column" marginBottom={1}>
              <Text dimColor wrap="truncate-end">
                <Text color={colorOf(n.role)}>○</Text> {n.n}. {n.title}
              </Text>
              <Text dimColor wrap="truncate-end">
                {'  '}
                {n.role} · {runsOn(n.role)}
                {n.after.length ? ` · ${T.waitsFor} ${n.after.join(', ')}` : ''}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

