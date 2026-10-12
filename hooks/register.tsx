// cgp-crew's hooks. This file owns the session state and every `$` call; the logic lives in core/ and the
// drawing in ui/, both pure, so they are tested without an engine.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { applyReport, startsNewFlow, statusLine, type Report } from './core/flow'
import { addRequest, endCall, endRun, reconcile, setSteps, startRun, statusOfTurn } from './core/runs'
import { isCrew } from './core/roles'
import { T } from './core/strings'
import { PROGRESS_TOOL, PROGRESS_TOOL_DEF, STEP_TOOL, STEP_TOOL_DEF } from './core/tools'
import { bandTree } from './ui/band'
import { PANE, paneTree } from './ui/pane'

const flow = atom({ plugin: 'cgp-crew', key: 'flow' } as const, null)
const runs = atom({ plugin: 'cgp-crew', key: 'runs' } as const, [])
const panel = atom({ plugin: 'cgp-crew', key: 'panel' } as const, { isCompact: false, showFinished: true, autoOpenedFor: '' })
const now = atom({ plugin: 'cgp-crew', key: 'now' } as const, 0)

/** How often running runs are checked against the engine's agent list, in clock ticks of one second. */
const RECONCILE_EVERY = 5

async function stamp($: EngineInterface): Promise<number> {
  const at = await $.clock.now()
  await update($, now, () => at)
  return at
}

/** Settles runs whose agents the engine reports ended or no longer lists. */
async function reconcileRuns($: EngineInterface): Promise<void> {
  const current = await read($, runs)
  if (!current.some(r => r.status === 'running')) return
  const listed = (await $.agent.list()).map(a => ({ id: a.id, status: String(a.status) }))
  const at = await $.clock.now()
  await update($, runs, list => reconcile(list, listed, at))
}

async function isPanelOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(p => p.id === PANE)
}

async function togglePanel($: EngineInterface): Promise<boolean> {
  if (await isPanelOpen($)) {
    await $.ui.close({ id: PANE })
    return false
  }
  await stamp($)
  await $.ui.open({ id: PANE, title: T.panelTitle })
  return true
}

/**
 * Opens the panel by itself once per flow, never again after the person closed it for that flow. A session with
 * no surface (`claude -p`, the SDK) has no panes: that must never fail the report or the spawn that asked.
 */
async function openPanelOnce($: EngineInterface, forFlow: string): Promise<void> {
  try {
    const view = await read($, panel)
    if (view.autoOpenedFor === forFlow) return
    await update($, panel, prev => ({ ...prev, autoOpenedFor: forFlow }))
    if (!(await isPanelOpen($))) await $.ui.open({ id: PANE, title: T.panelTitle })
  } catch {
    // No surface to open it on.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.tool.register(PROGRESS_TOOL_DEF)
    await $.tool.register(STEP_TOOL_DEF)
    await $.command.register({
      name: 'crew-panel',
      description: 'Show or hide the crew panel: every subagent with its role, model, progress, context, cost and time',
    })

    // A resumed session can carry runs whose agents died with the last process.
    await reconcileRuns($).catch(() => undefined)

    let tick = 0
    $.clock.every(1000, () => {
      void (async () => {
        const list = await read($, runs)
        if (!list.some(r => r.status === 'running')) return
        await stamp($)
        tick = (tick + 1) % RECONCILE_EVERY
        if (tick === 0) await reconcileRuns($)
      })().catch(() => undefined)
    })
    return started
  })

  on('command.run', { command: 'crew-panel' }, async $ => {
    try {
      return { text: (await togglePanel($)) ? T.panelOpened : T.panelClosed }
    } catch {
      return { text: T.noSurface }
    }
  })

  // The lead's report.
  on('tool.call', { tool: PROGRESS_TOOL }, async ($, e) => {
    const report = e as unknown as Report
    const before = await read($, flow)
    if (startsNewFlow(before, report)) {
      // A new flow starts with a clean panel; workers still running stay on it.
      await update($, runs, list => list.filter(r => r.status === 'running'))
    }
    const after = await update($, flow, prev => applyReport(prev, report))
    if (after && after.tasks.length > 0 && !after.isFinished) await openPanelOnce($, after.title)
    return { result: after ? `ok · ${statusLine(after, await read($, runs))}` : 'ok' }
  })

  // A worker's own steps: the call runs in the worker's loop, so `agentId` names the run.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    if (!e.agentId) return { result: 'ignored: only crew workers report steps' }
    const agentId = e.agentId
    await update($, runs, list => setSteps(list, agentId, input.done, input.total, input.note))
    return { result: 'ok' }
  })

  // A crew worker started without a reported plan still brings up a bar; and a run with no loop of its own
  // ends with its Agent call.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String((e as { subagent_type?: unknown }).subagent_type ?? '')
    if (isCrew(type) && (await read($, flow)) === null) {
      await update($, flow, prev => prev ?? applyReport(null, { phase: 'delegate' }))
    }
    const result = await next(e)
    const isBackground = (e as { run_in_background?: unknown }).run_in_background === true
    const toolUseId = e.tool_use_id
    if (toolUseId && !isBackground) {
      const at = await $.clock.now()
      const status = 'deny' in result && result.deny !== undefined ? 'failed' : 'isError' in result && result.isError ? 'failed' : 'done'
      await update($, runs, list => endCall(list, toolUseId, status, at))
    }
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const at = await stamp($)
    await update($, runs, list =>
      startRun(list, { agentId: started.agentId, toolUseId: e.tool_use_id, type: e.subagentType, description: e.description, model: started.model, at }),
    )
    if (isCrew(e.subagentType)) {
      const f = await read($, flow)
      await openPanelOnce($, f && !f.isFinished ? f.title : 'crew')
    }
    return started
  })

  // Each model request of a subagent: its context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (agentId && usage) {
      const effort = typeof e.effort === 'string' ? e.effort : undefined
      await update($, runs, list => addRequest(list, agentId, usage.model || e.model, usage, effort))
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      const at = await stamp($)
      await update($, runs, list => endRun(list, agentId, statusOfTurn(e.reason), at, e.usage))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    return paneTree({
      Box: ui.Box,
      Text: ui.Text,
      Button: ui.Button,
      Svg: 'Svg' in ui ? ui.Svg : undefined,
      isDesktop: e.surface === 'desktop' && 'Svg' in ui,
      columns: e.props.bodyColumns || 40,
      flow: await read($, flow),
      runs: await read($, runs),
      panel: await read($, panel),
      at: await read($, now),
      onToggleCompact: () => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact })),
      onToggleFinished: () => update($, panel, prev => ({ ...prev, showFinished: !prev.showFinished })),
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, flow)
    if (f === null || e.props.hasSurvey) return next(e)
    const ui = $.ui.resolve(e)
    return bandTree({
      Box: ui.Box,
      Text: ui.Text,
      Button: ui.Button,
      Svg: 'Svg' in ui ? ui.Svg : undefined,
      isDesktop: e.surface === 'desktop' && 'Svg' in ui,
      columns: e.props.bodyColumns,
      flow: f,
      runs: await read($, runs),
      onOpenPanel: () => void togglePanel($).catch(() => undefined),
      onDismiss: () => update($, flow, () => null),
    })
  })
}
