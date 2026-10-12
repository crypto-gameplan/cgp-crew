// The lead's flow: how a progress report updates it, and what each planned task looks like right now.

import type { AgentRun, Flow, Phase, PlannedTask } from '../../types'
import { matchKey } from './format'
import { isCrew, plannedRole } from './roles'
import { PHASE_WORD } from './strings'

export const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']

/** Upper bounds on what a report may carry; the model writes reports, so their sizes are not trusted. */
export const MAX_TASKS = 100
const MAX_TITLE = 200

/** What the progress tool receives. Every field is optional: a report changes only what it names. */
export type Report = {
  title?: string
  phase?: string
  tasks?: { title?: string; role?: string; tier?: string; after?: number[] }[]
  total?: number
  done?: number
  accepted?: number[]
  finished?: boolean
}

export const emptyFlow = (title = 'Crew'): Flow => ({
  title,
  phase: 'plan',
  tasks: [],
  total: 0,
  done: 0,
  accepted: [],
  isFinished: false,
})

const whole = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined

const cleanTasks = (tasks: Report['tasks']): PlannedTask[] =>
  (Array.isArray(tasks) ? tasks : []).slice(0, MAX_TASKS * 2).flatMap(t => {
    const title = typeof t?.title === 'string' ? t.title.trim().slice(0, MAX_TITLE) : ''
    if (!title) return []
    const after = Array.isArray(t.after) ? t.after : []
    const deps = [...new Set(after.slice(0, MAX_TASKS).map(whole).filter((x): x is number => !!x && x <= MAX_TASKS))]
    return [{ title, role: plannedRole(typeof (t.role ?? t.tier) === 'string' ? (t.role ?? t.tier) : undefined), after: deps }]
  }).slice(0, MAX_TASKS)

/** True when `report` starts a new flow: none yet, the last one finished, or a different title. */
export const startsNewFlow = (prev: Flow | null, report: Report): boolean => {
  if (!prev || prev.isFinished) return true
  const title = typeof report.title === 'string' ? report.title.trim().slice(0, MAX_TITLE) : ''
  return !!title && title !== prev.title
}

/** The flow after `report`; counters never leak from an earlier flow into a new one. */
export const applyReport = (prev: Flow | null, report: Report): Flow => {
  const base = startsNewFlow(prev, report) || !prev ? emptyFlow() : prev
  const tasks = report.tasks ? cleanTasks(report.tasks) : base.tasks
  const total = Math.min(MAX_TASKS, report.tasks ? tasks.length : (whole(report.total) ?? base.total))
  const cap = (x: number) => (total > 0 ? Math.min(total, x) : x)

  let accepted = base.accepted
  let done = base.done
  if (report.accepted) {
    accepted = [...new Set((Array.isArray(report.accepted) ? report.accepted.slice(0, MAX_TASKS * 2) : []).map(whole).filter((x): x is number => !!x && (total === 0 || x <= total)))].sort((a, b) => a - b)
    done = accepted.length
  } else if (report.done !== undefined) {
    done = whole(report.done) ?? done
  }
  if (report.tasks) accepted = accepted.filter(x => x <= total)

  const phase = report.finished
    ? 'close'
    : report.phase && (PHASES as readonly string[]).includes(report.phase)
      ? (report.phase as Phase)
      : base.phase
  return {
    title: (typeof report.title === 'string' ? report.title.trim().slice(0, MAX_TITLE) : '') || base.title,
    phase,
    tasks,
    total,
    done: cap(done),
    accepted,
    isFinished: report.finished === true,
  }
}

/** The run that belongs to a planned task: the latest one whose description names it. */
export const runFor = (task: PlannedTask, runs: readonly AgentRun[]): AgentRun | undefined => {
  const key = matchKey(task.title)
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i]
    if (run && matchKey(run.description) === key) return run
  }
  return undefined
}

export type SegmentState = 'accepted' | 'delivered' | 'active' | 'trouble' | 'waiting'
export type Segment = { n: number; title: string; role: string; state: SegmentState }

/** One segment per planned task, in plan order; without a task list, one per counted task. */
export const segmentsOf = (flow: Flow, runs: readonly AgentRun[]): Segment[] => {
  if (flow.tasks.length === 0) {
    const live = runningCrew(runs)
    return Array.from({ length: flow.total }, (_, i): Segment => ({
      n: i + 1,
      title: '',
      role: 'other',
      state: flow.isFinished || i < flow.done ? 'accepted' : i < flow.done + live ? 'active' : 'waiting',
    }))
  }
  const named = new Set(flow.accepted)
  return flow.tasks.map((task, i): Segment => {
    const n = i + 1
    const run = runFor(task, runs)
    // Without a list of accepted numbers, the first `done` tasks count as accepted.
    const isAccepted = flow.isFinished || (flow.accepted.length > 0 ? named.has(n) : n <= flow.done)
    const state: SegmentState = isAccepted
      ? 'accepted'
      : run?.status === 'running'
        ? 'active'
        : run?.status === 'done'
          ? 'delivered'
          : run
            ? 'trouble'
            : 'waiting'
    return { n, title: task.title, role: task.role, state }
  })
}

/** Crew workers running now: counted from the runs themselves, so a missed end can never leave it stuck. */
export const runningCrew = (runs: readonly AgentRun[]): number => runs.filter(r => r.status === 'running' && isCrew(r.type)).length

export const share = (flow: Flow): number => (flow.isFinished ? 1 : flow.total > 0 ? Math.min(1, flow.done / flow.total) : 0)

/** `Reviewing 3/5`, `Building · 2 running`, `Done`. */
export const statusLine = (flow: Flow, runs: readonly AgentRun[]): string => {
  if (flow.isFinished) return PHASE_WORD.close
  const word = PHASE_WORD[flow.phase]
  if (flow.phase === 'plan' || flow.phase === 'design') return word
  if (flow.total > 0) return `${word} ${flow.done}/${flow.total}`
  const live = runningCrew(runs)
  return live > 0 ? `${word} · ${live} running` : word
}

/** Planned tasks no run has picked up yet. */
export const upNext = (flow: Flow | null, runs: readonly AgentRun[]): (PlannedTask & { n: number })[] => {
  if (!flow || flow.isFinished) return []
  return flow.tasks.map((t, i) => ({ ...t, n: i + 1 })).filter(t => !runFor(t, runs))
}
