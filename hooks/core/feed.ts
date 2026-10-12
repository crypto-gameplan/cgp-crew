// The shared bar: what cgp-crew hands a host plugin (cgp-effort) so one bar above the prompt shows both, and
// how cgp-crew decides that a host is drawing it.

import type { AgentRun, CrewFeed, CrewHost, CrewRequest, Flow } from '../../types'
import { runningCrew, segmentsOf, share, statusLine, upNext } from './flow'
import { ACCENT } from './palette'
import { colorOf } from './roles'

/** The feed format this build writes. A host that knows a different one leaves cgp-crew to draw its own bar. */
export const FEED_VERSION = 1

export const feedOf = (flow: Flow | null, runs: readonly AgentRun[]): CrewFeed | null => {
  if (!flow) return null
  return {
    v: FEED_VERSION,
    title: flow.title,
    status: statusLine(flow, runs),
    segments: segmentsOf(flow, runs).map(s => ({ title: s.title, state: s.state, color: s.role === 'other' ? ACCENT : colorOf(s.role) })),
    share: share(flow),
    crew: runs.length + upNext(flow, runs).length,
    isWorking: runningCrew(runs) > 0,
    isFinished: flow.isFinished,
  }
}

/** True when a host says it draws this feed version, so cgp-crew stays out of the way. */
export const hostDraws = (host: CrewHost | null | undefined): boolean => !!host && host.v === FEED_VERSION && host.draws === true

/** The host request to act on now: a well-formed one newer than the last handled, else null. */
export const newRequest = (req: CrewRequest | null | undefined, handled: number): CrewRequest | null =>
  req && Number.isInteger(req.id) && req.id > handled && (req.action === 'panel' || req.action === 'hide') ? req : null

/** Feeds compared by content, so an unchanged feed is not written again (each write redraws the host). */
export const sameFeed = (a: CrewFeed | null, b: CrewFeed | null): boolean => JSON.stringify(a) === JSON.stringify(b)
