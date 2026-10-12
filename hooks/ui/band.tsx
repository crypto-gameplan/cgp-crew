// The crew bar above the prompt: the CGP mark, the flow's title, its task track and where the lead stands.
// Desktop draws the row as one SVG (sibling elements would wrap); the terminal draws it in text.

import type { AgentRun, Flow } from '../../types'
import { runningCrew, segmentsOf, share, statusLine, upNext, type Segment } from '../core/flow'
import { esc, fit, measure } from '../core/format'
import { ACCENT } from '../core/palette'
import { colorOf } from '../core/roles'
import { T } from '../core/strings'
import { mark } from './symbols'
import { doc, OK, text, track } from './svg'

/** What register.tsx hands the bar. Hooks keep `$` to themselves, so every action is a callback. */
export type BandDraw = {
  // From $.ui.resolve(e): the surface's own elements.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Box: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Text: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Svg?: any
  /** Only the desktop app draws SVG; other surfaces may list the element without painting it. */
  isDesktop: boolean
  columns: number
  flow: Flow
  runs: AgentRun[]
  onOpenPanel: () => unknown
  onDismiss: () => unknown
}

const ROW_H = 24
const MARK = 18

export const bandSvg = (flow: Flow, runs: readonly AgentRun[], width: number): string => {
  const status = statusLine(flow, runs)
  const statusW = Math.ceil(measure(status, 12)) + 4
  const titleMax = Math.max(60, width * 0.35)
  const title = fit(flow.title, 13, titleMax)
  const trackX = Math.round(MARK + 10 + measure(title, 13) + 12)
  const trackW = Math.max(40, width - trackX - statusW - 12)
  const isWorking = runningCrew(runs) > 0
  return doc(
    width,
    ROW_H,
    `${mark(0, (ROW_H - MARK) / 2, isWorking, MARK)}
${text(MARK + 10, 16.5, esc(title), 13, 'tx', 'font-weight="600"')}
${track(trackX, (ROW_H - 8) / 2, trackW, 8, segmentsOf(flow, runs), share(flow))}
${text(width, 16.5, esc(status), 12, flow.isFinished ? '' : 'mu', `text-anchor="end" font-variant-numeric="tabular-nums"${flow.isFinished ? ` fill="${OK}" font-weight="600"` : ''}`)}`,
  )
}

const GLYPH: Record<Segment['state'], string> = { accepted: '█', delivered: '▓', active: '▒', trouble: '▚', waiting: '░' }

export function bandTree(d: BandDraw) {
  const { Box, Text, Button, flow, runs } = d
  const crew = runs.length + upNext(flow, runs).length
  const openPanel = <Button key="crew-open" label={`${T.panelTitle} ${crew}`} plain onPress={d.onOpenPanel} />
  const dismiss = <Button key="crew-hide" label="✕" plain role="dismiss" onPress={d.onDismiss} />
  const status = statusLine(flow, runs)

  if (d.isDesktop && d.Svg) {
    const Svg = d.Svg
    // About 8 CSS px per column, less the two buttons and their gaps.
    const width = Math.max(200, Math.min(1600, (d.columns || 100) * 8 - 110))
    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg source={bandSvg(flow, runs, width)} alt={`${flow.title}: ${status}`} width={width} height={ROW_H} />
        {openPanel}
        {dismiss}
      </Box>
    )
  }

  const cols = d.columns || 80
  const titleW = Math.max(8, Math.min(28, flow.title.length + 1, Math.floor(cols / 3)))
  const room = Math.max(4, Math.min(30, cols - titleW - status.length - 22))
  const segments = segmentsOf(flow, runs)
  const cells =
    segments.length > 0 && segments.length <= room
      ? segments.map(s => (
          <Text key={`s${s.n}`} color={s.state === 'waiting' ? undefined : s.role === 'other' ? ACCENT : colorOf(s.role)} dimColor={s.state === 'waiting'}>
            {GLYPH[s.state]}
          </Text>
        ))
      : [
          <Text key="bar" color={ACCENT}>
            {'█'.repeat(Math.round(room * share(flow))).padEnd(room, '░')}
          </Text>,
        ]
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={ACCENT}>▮</Text>
      <Box width={titleW} flexShrink={0}>
        <Text bold wrap="truncate-end">
          {flow.title}
        </Text>
      </Box>
      <Text>{cells}</Text>
      <Text color={flow.isFinished ? OK : undefined} dimColor={!flow.isFinished}>
        {status}
      </Text>
      {openPanel}
      {dismiss}
    </Box>
  )
}
