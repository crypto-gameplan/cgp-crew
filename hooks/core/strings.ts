// Every word the band and the panel show. English only.

import type { Phase, RunStatus } from '../../types'

export const T = {
  panelTitle: 'Crew',
  noRuns: 'Nobody on the crew yet.',
  running: 'On it',
  finished: 'Finished',
  planned: 'Up next',
  compact: 'Compact',
  expand: 'Expand',
  waitsFor: 'waits for',
  round: 'round',
  tokens: 'tokens',
  workers: 'workers',
  panelOpened: 'Crew panel open.',
  panelClosed: 'Crew panel closed.',
  noSurface: 'The crew panel needs the terminal or the desktop app.',
} as const

export const PHASE_WORD: Record<Phase, string> = {
  plan: 'Planning',
  design: 'Designing',
  delegate: 'Building',
  review: 'Reviewing',
  close: 'Done',
}

export const STATUS_WORD: Record<RunStatus, string> = {
  running: 'running',
  done: 'done',
  failed: 'failed',
  stopped: 'stopped',
  ended: 'ended',
}
