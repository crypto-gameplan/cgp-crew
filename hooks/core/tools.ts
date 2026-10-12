// The two tools cgp-crew adds. The lead reports its flow through `progress`; each worker reports its own steps
// through `step`. A plugin's tool is called mcp__<plugin>__<name>.

import { PHASES } from './flow'
import { ROLES } from './roles'

export const PROGRESS_TOOL = 'mcp__cgp-crew__progress'
export const STEP_TOOL = 'mcp__cgp-crew__step'

export const PROGRESS_TOOL_DEF = {
  name: 'progress',
  description:
    'Keep the crew bar and crew panel in step with your /cgp-crew flow. Send the plan once it is shown to the user ' +
    '(title, tasks, phase), send the accepted task numbers after every review, a new phase when it changes, a new task ' +
    'list after re-planning, and finished: true when you close. Anything you leave out stays as it was.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The whole job in a few words. A different title starts a new flow.' },
      phase: { type: 'string', enum: [...PHASES] },
      tasks: {
        type: 'array',
        description:
          'Every worker task in plan order (task 1 first). Use each title, word for word, as the description of the Agent call that runs it: that is how the panel finds the run.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A few words.' },
            role: { type: 'string', enum: [...ROLES] },
            after: { type: 'array', items: { type: 'integer', minimum: 1 }, description: 'Task numbers it waits for.' },
          },
          required: ['title', 'role'],
        },
      },
      accepted: { type: 'array', items: { type: 'integer', minimum: 1 }, description: 'Numbers of every task accepted so far.' },
      done: { type: 'integer', minimum: 0, description: 'Count of accepted tasks, when you do not send `accepted`.' },
      total: { type: 'integer', minimum: 0, description: 'Task count, only when you send no `tasks`.' },
      finished: { type: 'boolean', description: 'True once the flow is closed.' },
    },
  },
}

export const STEP_TOOL_DEF = {
  name: 'step',
  description:
    'For cgp-crew workers: show your progress on the crew panel. After reading your brief, send `total` (your plan in ' +
    '3 to 8 steps) with `done: 0`; then send `done` after each step, with a short `note` for the step you are on. ' +
    'It only moves a bar, so call it freely.',
  inputSchema: {
    type: 'object',
    properties: {
      done: { type: 'integer', minimum: 0, description: 'Steps finished.' },
      total: { type: 'integer', minimum: 1, description: 'Steps planned; send a new value if your plan changes.' },
      note: { type: 'string', description: 'The current step, a few words.' },
    },
    required: ['done'],
  },
}
