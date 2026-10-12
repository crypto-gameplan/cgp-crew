// Subagent runs: started on spawn, fed by each model request, settled when they end, and checked against the
// engine's own agent list so no run can stay "running" after its agent is gone.

import type { AgentRun, RunStatus } from '../../types'
import { matchKey } from './format'
import { costOf, tokensOf, windowOf, type Usage } from './models'
import { roleOf } from './roles'

/** How many runs the session keeps; the oldest finished ones go first. */
export const RUN_LIMIT = 150

/** How long a fresh run may be missing from the engine's list before it counts as gone. */
export const LIST_GRACE_MS = 20_000

export type Spawn = {
  agentId?: string
  toolUseId: string
  type: string
  description: string
  model: string
  at: number
}

export const startRun = (runs: readonly AgentRun[], s: Spawn): AgentRun[] => {
  const key = s.agentId ?? s.toolUseId
  const sameTask = matchKey(s.description)
  const earlier = sameTask ? runs.filter(r => r.key !== key && matchKey(r.description) === sameTask).length : 0
  const run: AgentRun = {
    key,
    agentId: s.agentId,
    toolUseId: s.toolUseId,
    type: s.type,
    role: roleOf(s.type),
    description: s.description,
    model: s.model,
    status: 'running',
    startedAt: s.at,
    context: 0,
    window: windowOf(s.model),
    tokens: 0,
    costUsd: 0,
    requests: 0,
    round: earlier + 1,
  }
  return trim([...runs.filter(r => r.key !== key), run])
}

/** Keeps every running run and the newest finished ones, up to RUN_LIMIT. */
const trim = (runs: AgentRun[]): AgentRun[] => {
  if (runs.length <= RUN_LIMIT) return runs
  let drop = runs.length - RUN_LIMIT
  return runs.filter(r => {
    if (drop > 0 && r.status !== 'running') {
      drop--
      return false
    }
    return true
  })
}

const update = (runs: readonly AgentRun[], agentId: string, change: (r: AgentRun) => AgentRun): AgentRun[] =>
  runs.map(r => (r.agentId === agentId ? change(r) : r))

/** One model request of a run: its context, tokens and cost. A request also revives a run resumed by a message. */
export const addRequest = (runs: readonly AgentRun[], agentId: string, model: string, usage: Usage, effort?: string): AgentRun[] =>
  update(runs, agentId, r => ({
    ...r,
    model: model || r.model,
    window: windowOf(model || r.model),
    effort: effort ?? r.effort,
    status: 'running',
    endedAt: undefined,
    context: tokensOf(usage),
    tokens: r.tokens + tokensOf(usage),
    costUsd: r.costUsd + costOf(model || r.model, usage),
    requests: r.requests + 1,
  }))

/** How a turn ended, as the run's status. */
export const statusOfTurn = (reason: string): RunStatus => (reason === 'answer' ? 'done' : reason === 'aborted' ? 'stopped' : 'failed')

/** The run's turn ended. A run whose requests went unseen takes the turn's own usage sum. */
export const endRun = (runs: readonly AgentRun[], agentId: string, status: RunStatus, at: number, usage?: Usage & { model?: string }): AgentRun[] =>
  update(runs, agentId, r => {
    const unseen = r.requests === 0 && usage
    const model = (unseen && usage.model) || r.model
    return {
      ...r,
      status,
      endedAt: at,
      ...(unseen ? { model, tokens: tokensOf(usage), costUsd: costOf(model, usage), context: tokensOf(usage) } : {}),
    }
  })

/** A run without an agent id (no local loop) ends with its Agent tool call. */
export const endCall = (runs: readonly AgentRun[], toolUseId: string, status: RunStatus, at: number): AgentRun[] =>
  runs.map(r => (r.toolUseId === toolUseId && !r.agentId && r.status === 'running' ? { ...r, status, endedAt: at } : r))

const count = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1000, Math.max(0, Math.round(v))) : fallback

export const setSteps = (runs: readonly AgentRun[], agentId: string, done: unknown, total: unknown, note: unknown): AgentRun[] =>
  update(runs, agentId, r => {
    const t = count(total, r.steps?.total ?? 0)
    const d = count(done, r.steps?.done ?? 0)
    const n = typeof note === 'string' ? note.trim().slice(0, 120) : ''
    return { ...r, steps: { total: t, done: t > 0 ? Math.min(d, t) : d, note: n || undefined } }
  })

/** The engine's view of an agent, as `$.agent.list()` gives it. */
export type Listed = { id: string; status: string }

const SETTLED: Record<string, RunStatus> = { completed: 'done', failed: 'failed', killed: 'stopped' }

/**
 * Settles running runs the engine says have ended, or no longer lists at all (after a grace period, so a run
 * spawned a moment ago is not mistaken for a gone one). Runs without an agent id are left to `endCall`.
 */
export const reconcile = (runs: readonly AgentRun[], listed: readonly Listed[], at: number): AgentRun[] => {
  const byId = new Map(listed.map(a => [a.id, a.status]))
  let changed = false
  const next = runs.map(r => {
    if (r.status !== 'running' || !r.agentId) return r
    const engine = byId.get(r.agentId)
    const settled = engine === undefined ? (at - r.startedAt > LIST_GRACE_MS ? 'ended' : undefined) : SETTLED[engine]
    if (!settled) return r
    changed = true
    return { ...r, status: settled, endedAt: at }
  })
  return changed ? next : (runs as AgentRun[])
}

export type Totals = { costUsd: number; tokens: number; spanMs: number }

/** Cost and tokens summed, and the wall-clock span from the first start to the last end (or now). */
export const totalsOf = (runs: readonly AgentRun[], at: number): Totals => {
  if (runs.length === 0) return { costUsd: 0, tokens: 0, spanMs: 0 }
  const first = Math.min(...runs.map(r => r.startedAt))
  const last = Math.max(...runs.map(r => r.endedAt ?? Math.max(at, r.startedAt)))
  return {
    costUsd: runs.reduce((sum, r) => sum + r.costUsd, 0),
    tokens: runs.reduce((sum, r) => sum + r.tokens, 0),
    spanMs: last - first,
  }
}

export const elapsedOf = (r: AgentRun, at: number): number => (r.endedAt ?? Math.max(at, r.startedAt)) - r.startedAt

/** How far a run is: its own steps when it reports them, full once done, else null. */
export const progressOf = (r: AgentRun): number | null => {
  if (r.status === 'done') return 1
  if (r.steps && r.steps.total > 0) return Math.min(1, r.steps.done / r.steps.total)
  return null
}

export const contextShare = (r: AgentRun): number => (r.window > 0 ? Math.min(1, r.context / r.window) : 0)
