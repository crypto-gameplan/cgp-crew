// cgp-crew's $.state contract: the flow the lead reports, every subagent run of the session, and the panel's view.

/** Where the lead stands in its flow. */
export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

/** One task of the lead's plan, numbered from 1 by its place in `Flow.tasks`. */
export type PlannedTask = {
  title: string
  /** `architect`, `investigator`, `engineer`, `builder`, `runner`, or `other`. */
  role: string
  /** Numbers of the tasks this one waits for. */
  after: number[]
}

export type Flow = {
  title: string
  phase: Phase
  tasks: PlannedTask[]
  /** Planned task count; equals `tasks.length` whenever tasks were reported. */
  total: number
  /** Tasks accepted in review. */
  done: number
  /** Which task numbers were accepted, when the lead says; drives the band's segments. */
  accepted: number[]
  isFinished: boolean
}

/** `stopped`: interrupted or killed. `ended`: the engine no longer lists it and no end was seen. */
export type RunStatus = 'running' | 'done' | 'failed' | 'stopped' | 'ended'

export type AgentRun = {
  /** The agent id, or the Agent tool call's id for a run that has none. */
  key: string
  agentId?: string
  toolUseId: string
  type: string
  role: string
  description: string
  model: string
  effort?: string
  status: RunStatus
  startedAt: number
  endedAt?: number
  /** Tokens in the latest request: how full the run's context is. */
  context: number
  window: number
  /** All tokens across the run's requests. */
  tokens: number
  costUsd: number
  requests: number
  /** 1 for a task's first run, 2 when it came back for another round, and so on. */
  round: number
  /** Self-reported through the step tool. */
  steps?: { done: number; total: number; note?: string }
}

export type Panel = {
  isCompact: boolean
  showFinished: boolean
  /** The flow title the panel last opened itself for, so it opens once per flow. */
  autoOpenedFor: string
}

declare module 'claude-code' {
  interface PluginState {
    'cgp-crew': {
      flow: Flow | null
      runs: AgentRun[]
      panel: Panel
      now: number
    }
  }
}
