import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { AgentRun } from '../types'
import { applyReport, MAX_TASKS, runFor, runningCrew, segmentsOf, startsNewFlow, statusLine, upNext } from '../hooks/core/flow'
import { durationText, fit, matchKey, measure, tokensText, usdText } from '../hooks/core/format'
import { costOf, modelLabel, windowOf } from '../hooks/core/models'
import { colorOf, isCrew, plannedRole, roleOf, symbolOf } from '../hooks/core/roles'
import { addRequest, endCall, endRun, LIST_GRACE_MS, reconcile, RUN_LIMIT, setSteps, startRun, statusOfTurn, totalsOf } from '../hooks/core/runs'
import { ACCENT } from '../hooks/core/palette'
import { bandSvg } from '../hooks/ui/band'
import { mark, symbol } from '../hooks/ui/symbols'

const expectNear = (actual: number | undefined, wanted: number) => expect(Math.abs((actual ?? NaN) - wanted) < 1e-9).toBe(true)

const spawn = (description: string, agentId: string | undefined, type = 'cgp-crew:crew-builder', at = 1000) => ({
  agentId,
  toolUseId: `tu-${agentId ?? description}`,
  type,
  description,
  model: 'claude-opus-5-5',
  at,
})

describe('roles', () => {
  test('crew agents are recognised with or without the plugin prefix', () => {
    expect(isCrew('cgp-crew:crew-engineer')).toBe(true)
    expect(isCrew('crew-runner')).toBe(true)
    expect(isCrew('Explore')).toBe(false)
    expect(isCrew('general-purpose')).toBe(false)
  })

  test('agent types and planned roles map to a role', () => {
    expect(roleOf('cgp-crew:crew-architect')).toBe('architect')
    expect(roleOf('crew-investigator')).toBe('investigator')
    expect(roleOf('cgp-crew:crew-nobody')).toBe('other')
    expect(roleOf('Explore')).toBe('other')
    expect(plannedRole('Engineer')).toBe('engineer')
    expect(plannedRole('cgp-crew:crew-runner')).toBe('runner')
    expect(plannedRole(undefined)).toBe('other')
    expect(symbolOf('Explore')).toBe('explore')
  })
})

describe('flow reports', () => {
  test('a plan sets the tasks, cleans roles and dependencies, and opens on task 0 of n', () => {
    const f = applyReport(null, {
      title: 'CSV export',
      phase: 'delegate',
      tasks: [
        { title: 'Find the export path', role: 'investigator' },
        { title: 'Write the CSV encoder', tier: 'crew-engineer', after: [1, 0, -3, 1] },
        { title: '   ' },
      ],
    })
    expect(f.total).toBe(2)
    expect(f.tasks.map(t => t.role)).toEqual(['investigator', 'engineer'])
    expect(f.tasks[1]?.after).toEqual([1])
    expect(statusLine(f, [])).toBe('Building 0/2')
  })

  test('accepted numbers set done, ignore numbers outside the plan, and drive segments', () => {
    let f = applyReport(null, { title: 'X', tasks: [{ title: 'a', role: 'runner' }, { title: 'b', role: 'runner' }, { title: 'c', role: 'runner' }] })
    f = applyReport(f, { accepted: [3, 3, 9, 0], phase: 'review' })
    expect(f.accepted).toEqual([3])
    expect(f.done).toBe(1)
    expect(segmentsOf(f, []).map(s => s.state)).toEqual(['waiting', 'waiting', 'accepted'])
    expect(statusLine(f, [])).toBe('Reviewing 1/3')
  })

  test('done never passes the task count; finished closes the flow', () => {
    const f = applyReport(applyReport(null, { title: 'X', total: 2 }), { done: 7 })
    expect(f.done).toBe(2)
    const closed = applyReport(f, { finished: true })
    expect(closed.phase).toBe('close')
    expect(statusLine(closed, [])).toBe('Done')
  })

  test('a new title or a finished flow starts over', () => {
    const first = applyReport(null, { title: 'One', total: 3, done: 2 })
    expect(startsNewFlow(first, { title: 'Two' })).toBe(true)
    expect(startsNewFlow(first, { done: 3 })).toBe(false)
    expect(applyReport(first, { title: 'Two' }).done).toBe(0)
    expect(startsNewFlow(applyReport(first, { finished: true }), { done: 1 })).toBe(true)
  })

  test('segments follow each task run: running, delivered, trouble', () => {
    const f = applyReport(null, {
      title: 'X',
      tasks: [{ title: 'Alpha', role: 'builder' }, { title: 'Beta', role: 'builder' }, { title: 'Gamma', role: 'builder' }, { title: 'Delta', role: 'builder' }],
    })
    let runs = startRun([], spawn('1. Alpha', 'a1'))
    runs = startRun(runs, spawn('beta', 'b1'))
    runs = startRun(runs, spawn('Gamma!', 'c1'))
    runs = endRun(runs, 'b1', 'done', 2000)
    runs = endRun(runs, 'c1', 'failed', 2000)
    expect(segmentsOf(f, runs).map(s => s.state)).toEqual(['active', 'delivered', 'trouble', 'waiting'])
    expect(upNext(f, runs).map(t => t.n)).toEqual([4])
    expect(runningCrew(runs)).toBe(1)
  })

  test('task titles match runs despite numbering, case and punctuation', () => {
    expect(matchKey('Task 3: Add CSV writer.')).toBe('add csv writer')
    expect(matchKey('3) add  csv-writer')).toBe('add csv writer')
    const runs = startRun([], spawn('2. Add CSV writer', 'x'))
    expect(runFor({ title: 'Add CSV writer', role: 'builder', after: [] }, runs)?.key).toBe('x')
  })
})

describe('untrusted report sizes', () => {
  test('huge counts and lists are capped before anything is drawn', () => {
    const f = applyReport(null, { title: 'x'.repeat(5000), total: 1e12 })
    expect(f.total).toBe(MAX_TASKS)
    expect(f.title.length).toBe(200)
    expect(segmentsOf(f, []).length).toBe(MAX_TASKS)
    const many = Array.from({ length: 5000 }, (_, i) => ({ title: `t${i}`, role: 'runner', after: [1e9, 2] }))
    const g = applyReport(null, { title: 'y', tasks: many, accepted: Array.from({ length: 5000 }, (_, i) => i + 1) })
    expect(g.tasks.length).toBe(MAX_TASKS)
    expect(g.tasks[0]?.after).toEqual([2])
    expect(g.done).toBe(MAX_TASKS)
  })

  test('malformed fields are ignored, not thrown on', () => {
    const f = applyReport(null, { title: 42, tasks: 'nope', accepted: 'x' } as never)
    expect(f.tasks).toEqual([])
    const runs = setSteps(startRun([], spawn('A', 'a')), 'a', 'x', Infinity, { bad: true })
    expect(runs[0]?.steps).toEqual({ done: 0, total: 0, note: undefined })
  })
})

describe('runs', () => {
  test('a task sent back counts its rounds', () => {
    let runs = startRun([], spawn('Fix login', 'a'))
    runs = endRun(runs, 'a', 'done', 2000)
    runs = startRun(runs, spawn('Fix login', 'b'))
    expect(runs.map(r => r.round)).toEqual([1, 2])
  })

  test('requests add tokens and cost; the latest request is the context', () => {
    let runs = startRun([], spawn('A', 'a'))
    runs = addRequest(runs, 'a', 'claude-opus-5-5', { input_tokens: 1000, output_tokens: 500 }, 'high')
    runs = addRequest(runs, 'a', 'claude-opus-5-5', { input_tokens: 2000, cache_read_input_tokens: 10_000 })
    const r = runs[0] as AgentRun
    expect(r.requests).toBe(2)
    expect(r.context).toBe(12_000)
    expect(r.tokens).toBe(13_500)
    expect(r.effort).toBe('high')
    expectNear(r.costUsd, (1000 * 4 + 500 * 20 + 2000 * 4 + 10_000 * 0.2) / 1e6)
  })

  test('a turn ends a run by its reason; unseen requests take the turn sum', () => {
    expect(statusOfTurn('answer')).toBe('done')
    expect(statusOfTurn('aborted')).toBe('stopped')
    expect(statusOfTurn('error')).toBe('failed')
    const runs = endRun(startRun([], spawn('A', 'a')), 'a', 'done', 5000, { input_tokens: 100, output_tokens: 50, model: 'claude-haiku-5-5' })
    expect(runs[0]?.tokens).toBe(150)
    expect(runs[0]?.endedAt).toBe(5000)
  })

  test('a run without an agent id ends with its Agent call', () => {
    const runs = endCall(startRun([], spawn('Remote', undefined)), 'tu-Remote', 'done', 3000)
    expect(runs[0]?.status).toBe('done')
  })

  test('reconcile settles what the engine says ended and what it no longer lists', () => {
    let runs = startRun([], spawn('A', 'a', 'crew-builder', 0))
    runs = startRun(runs, spawn('B', 'b', 'crew-builder', 0))
    runs = startRun(runs, spawn('C', 'c', 'crew-builder', 0))
    runs = startRun(runs, spawn('D', 'd', 'crew-builder', LIST_GRACE_MS))
    const listed = [
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'killed' },
      { id: 'c', status: 'running' },
    ]
    const after = reconcile(runs, listed, LIST_GRACE_MS + 1000)
    expect(after.map(r => r.status)).toEqual(['done', 'stopped', 'running', 'running'])
    expect(reconcile(after, [{ id: 'c', status: 'running' }], LIST_GRACE_MS * 3).map(r => r.status)).toEqual(['done', 'stopped', 'running', 'ended'])
  })

  test('reconcile returns the same list when nothing changed', () => {
    const runs = startRun([], spawn('A', 'a'))
    expect(reconcile(runs, [{ id: 'a', status: 'running' }], 5000)).toBe(runs)
  })

  test('steps clamp to the plan', () => {
    const runs = setSteps(startRun([], spawn('A', 'a')), 'a', 9, 4, '  wiring  ')
    expect(runs[0]?.steps).toEqual({ done: 4, total: 4, note: 'wiring' })
  })

  test('the list keeps every running run when it trims', () => {
    let runs: AgentRun[] = []
    for (let i = 0; i < RUN_LIMIT + 10; i++) {
      runs = startRun(runs, spawn(`t${i}`, `id${i}`))
      if (i > 0) runs = endRun(runs, `id${i}`, 'done', 2000)
    }
    expect(runs.length).toBe(RUN_LIMIT)
    expect(runs.some(r => r.key === 'id0')).toBe(true)
  })

  test('totals span from the first start to the last end', () => {
    let runs = startRun([], spawn('A', 'a', 'crew-builder', 1000))
    runs = endRun(runs, 'a', 'done', 4000)
    expect(totalsOf(runs, 9000).spanMs).toBe(3000)
  })
})

describe('models and formatting', () => {
  test('current price list and context windows', () => {
    expectNear(costOf('claude-haiku-5-5', { input_tokens: 1e6 }), 0.1)
    expectNear(costOf('claude-fable-5-1', { output_tokens: 1e6 }), 50)
    expectNear(costOf('claude-opus-5-5', { cache_creation_input_tokens: 1e6 }), 5)
    expect(windowOf('claude-haiku-5-5')).toBe(1_000_000)
    expect(windowOf('claude-haiku-4-5')).toBe(200_000)
    expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelLabel('claude-fable-5-1[1m]')).toBe('Fable 5.1')
  })

  test('numbers and text fitting', () => {
    expect(tokensText(1_234_567)).toBe('1.2M')
    expect(tokensText(45_600)).toBe('46k')
    expect(usdText(0.5)).toBe('$0.50')
    expect(durationText(3_725_000)).toBe('1:02:05')
    const cut = fit('A rather long task title for the crew', 13, 80)
    expect(cut.endsWith('…')).toBe(true)
    expect(measure(cut, 13)).toBeLessThanOrEqual(80)
  })
})

describe('drawing', () => {
  test('every role, Explore and unknown agents draw a tile in their colour', () => {
    for (const role of ['architect', 'investigator', 'engineer', 'builder', 'runner', 'explore', 'other']) {
      const out = symbol(0, 0, role, false, true)
      expect(out).toContain(`s-${role} run`)
      expect(out).toContain(colorOf(role))
    }
    expect(symbol(0, 0, 'nobody')).toContain('s-other')
    expect(symbol(0, 0, 'runner', true)).toContain('opacity="0.45"')
  })

  test('the mark carries the gold bar and builds only while workers run', () => {
    expect(mark(0, 0)).toContain(ACCENT)
    expect(mark(0, 0)).not.toContain('mk run')
    expect(mark(0, 0, true)).toContain('mk run')
  })

  test('the band draws one segment per task and escapes the title', () => {
    const f = applyReport(null, { title: 'A <b> & C', tasks: [{ title: 'one', role: 'builder' }, { title: 'two', role: 'runner' }] })
    const out = bandSvg(f, [], 600)
    expect(out).toContain('A &lt;b&gt; &amp; C')
    expect(out.match(/<rect class="tr" x="/g)?.length).toBe(2)
  })
})

// Nothing sits beneath the plugin in a test: these stand for the engine's own answers.
const engineBottom = (on: On) => {
  on('tool.call', async e => ({ result: `engine ran ${String(e.tool)}` }) as never)
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
}

describe('in the engine', () => {
  const BAND = {
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }
  const PANEL = {
    component: 'Pane',
    requestId: 'cgp-crew-panel',
    props: { title: 'Crew', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  }

  test('a reported plan draws the bar and the panel on terminal and desktop', async ($, on) => {
    engineBottom(on)
    const res = await $.tool.call({
      tool: 'mcp__cgp-crew__progress',
      title: 'CSV export',
      phase: 'delegate',
      tasks: [
        { title: 'Find the export path', role: 'investigator' },
        { title: 'Write the encoder', role: 'engineer', after: [1] },
      ],
    } as never)
    expect(JSON.stringify(res)).toContain('Building 0/2')

    for (const surface of ['terminal', 'desktop'] as const) {
      const band = await $.ui.mount({ plugin: 'cgp-crew', surface, ...BAND } as never)
      const bandText = JSON.stringify(await band.drawn())
      expect(bandText).toContain('CSV export')
      expect(await band.find({ key: 'crew-open' })).toBeDefined()
      await band.unmount()

      const pane = await $.ui.mount({ plugin: 'cgp-crew', surface, ...PANEL } as never)
      const paneText = JSON.stringify(await pane.drawn())
      expect(paneText).toContain('Find the export path')
      expect(paneText).toContain('Up next')
      await pane.unmount()
    }
  })

  test('the step tool answers only inside a worker', async ($, on) => {
    engineBottom(on)
    const res = await $.tool.call({ tool: 'mcp__cgp-crew__step', done: 1, total: 3 } as never)
    expect(JSON.stringify(res)).toContain('only crew workers')
  })

  test('dismissing the bar clears the flow', async ($, on) => {
    engineBottom(on)
    await $.tool.call({ tool: 'mcp__cgp-crew__progress', title: 'Job', total: 2 } as never)
    const band = await $.ui.mount({ plugin: 'cgp-crew', surface: 'terminal', ...BAND } as never)
    await band.press({ key: 'crew-hide' })
    expect(JSON.stringify(await band.drawn())).not.toContain('Job')
    await band.unmount()
  })
})
