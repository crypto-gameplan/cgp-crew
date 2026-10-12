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
  /** The id of the last host request acted on, so a request is never acted on twice. */
  handledRequest: number
}

/** One task of the shared bar: its state and the colour to draw it in. */
export type FeedSegment = { title: string; color: string; state: 'accepted' | 'delivered' | 'active' | 'trouble' | 'waiting' }

/**
 * The crew bar, ready to draw, for another plugin that shows it in its own band (cgp-effort). `v` is the format;
 * a host draws only versions it knows. Null while no flow is shown.
 */
export type CrewFeed = {
  v: 1
  title: string
  /** `Reviewing 3/5`, `Building · 2 running`, `Done`. */
  status: string
  segments: FeedSegment[]
  /** Share of accepted tasks, 0 to 1, for a host that draws one bar instead of segments. */
  share: number
  /** Workers run plus tasks waiting, for the crew button's label. */
  crew: number
  isWorking: boolean
  isFinished: boolean
}

/** What cgp-effort publishes when it can show the crew feed in its own band. */
export type CrewHost = { v: number; draws: boolean }

/**
 * A press in the host's crew row, for cgp-crew to carry out: `panel` toggles the crew panel, `hide` hides the bar.
 * `id` grows with every press. (A slash command would wait until the session is idle; this is read every second.)
 */
export type CrewRequest = { id: number; action: 'panel' | 'hide' }

declare module 'claude-code' {
  interface PluginState {
    'cgp-crew': {
      flow: Flow | null
      runs: AgentRun[]
      panel: Panel
      now: number
      feed: CrewFeed | null
    }
    'cgp-effort': {
      crewHost: CrewHost | null
      crewRequest: CrewRequest | null
    }
  }
}
