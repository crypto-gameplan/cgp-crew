# CGP Crew guide

Version 1.1.1, updated 2026-10-13. This guide describes that version; a newer plugin may differ in details.

This is the reference for CGP Crew, a Claude Code plugin by Crypto Gameplan. An agent that is asked how the plugin works should answer from this file. Names in quotes are the words the person sees in the app, so they can find them.

## What it does

CGP Crew runs a larger coding job with a lead and five worker agents. The person's own session is the lead: it plans the job, settles the design, writes a brief for each task and checks every result before it counts. The workers write the code, each on the model and effort its role needs.

While the crew works, a bar above the prompt shows the plan as one segment per task, and a panel lists every worker with its model, progress, context use, cost and time.

## Installing, updating and removing

CGP Crew is listed in the Crypto Gameplan marketplace, `crypto-gameplan/cgp-marketplace`. Install in Claude Code with two commands:

```text
/plugin marketplace add crypto-gameplan/cgp-marketplace
/plugin install cgp-crew@crypto-gameplan
```

Then run `/reload-plugins` or restart Claude Code. The plugin brings a skill (`cgp-crew`), five agents and a mod for the bar and the panel. The bar and the panel work in the desktop app and in the terminal.

To update, run `/plugin marketplace update crypto-gameplan`, then `/plugin update cgp-crew@crypto-gameplan`, and restart. To remove it, run `/plugin uninstall cgp-crew@crypto-gameplan`.

## Starting a job

```text
/cgp-crew:cgp-crew add a CSV export to the reports page
```

The skill only starts when the person calls it; Claude never starts a crew on its own. The lead does its best work on a strong model at high effort, so the session's model and effort matter. Each worker sets its own.

Before it starts, the lead checks that the five agents are available (`cgp-crew:crew-architect` and the others). Without them it stops and says so.

## How a job runs

1. The lead reads what it needs: the relevant code, `CLAUDE.md`, recent commits. For a wide search it sends an Explore agent so its own context stays free.
2. It cuts the job into tasks, each with a role, a brief and the tasks it waits for, and shows the person a numbered plan. When the request can be read in ways that lead to different work, it asks first.
3. If the job touches what a user sees, the design comes first. Small UI work the lead decides and writes into the brief. A new screen or flow it shows as a mockup and waits for the person's reaction. A design task goes to the architect only when the person asks for that.
4. It delegates: one Agent call per task, with the task's title as the description. Independent tasks run in parallel; a dependent task starts only after the tasks it waits for are accepted.
5. It reviews every result: it reads the actual changes, holds them against the brief, looks at edge cases and error paths, and runs the checks itself when that is cheap. Then it accepts the task, sends it back with a precise list of what is wrong, or fixes a one-line problem itself. A task goes back at most twice; after that the lead re-plans it or asks the person.
6. It closes with a summary: what changed and where, what was checked and how, what was left out and why, and follow-ups it noticed.

The lead writes no feature code itself, and no worker plans, designs or signs off.

### A new project

In an empty folder, or one with no sources, manifests or `CLAUDE.md`, the lead sets the project up before any worker starts:

1. It runs `git init` and adds a `.gitignore`.
2. It asks once for what the request leaves open: platform and stack, who the product is for, what the first version must and must not do, hard limits.
3. It writes `docs/SPEC.md` (goals, stack, modules, data model, flows, what makes version one done), `docs/PLAN.md` (the tasks in order, task 1 always the scaffold), a `CLAUDE.md` of 20 to 40 lines, and `filemap.md` (one line per folder and important file).
4. It shows a summary of the spec and the plan and waits for a clear yes.
5. It builds in order, commits after each accepted task, and marks tasks done in `docs/PLAN.md`, so a later session can resume from the file. It pushes only when the person asks.

## The crew

| Role | Agent | Model and effort | Gets |
|---|---|---|---|
| Architect | `crew-architect` | Fable, high | The hardest problems only: complex logic, bugs that defeated normal debugging or an investigator, and design work the person handed over |
| Investigator | `crew-investigator` | Opus, xhigh | Unfamiliar or tangled code, an unknown root cause, unclear architecture, large contexts |
| Engineer | `crew-engineer` | Opus, high | Delicate changes with a clear approach: refactors across files, fixes that must keep invariants, logic full of edge cases |
| Builder | `crew-builder` | Opus, medium | Everyday features and fixes with a known cause, in a few files |
| Runner | `crew-runner` | Opus, low | Renames, boilerplate, config, small isolated fixes, running builds and tests |

The lead gives each task the cheapest role that will get it right the first time, and the stronger one when it is torn between two (except the architect, the most expensive role). A task that needs both finding out and careful change becomes two tasks: the investigator finds out, the engineer carries it out.

Every worker stays inside its brief, leaves UI decisions to the lead, checks its work before reporting, and reports the changed files, the command it ran and its result, and open questions.

## The bar

The bar sits above the prompt from the moment the lead shows a plan.

| In the bar | Meaning |
|---|---|
| The CGP mark | Its bars build up while workers run. |
| The title | The job, in a few words. A new title starts a new flow. |
| The track | One segment per task. Filled in the role's colour once accepted, half filled while the work waits for review, pulsing while a worker is on it, red when a run failed, empty while waiting. Too many tasks for the width become one bar filled to the share done. |
| The status | Where the lead stands: "Planning", "Designing", "Building 2/5", "Reviewing 3/5", "Done", or "Building · 2 running" without a task count. |
| "Crew n" | Opens or closes the panel. n is the number of workers and planned tasks. |
| ✕ | Hides the bar until the lead reports again. |

In the terminal the track is text: █ accepted, ▓ delivered, ▒ active, ▚ failed, ░ waiting.

With CGP Effort 1.1 or later in its "Dashboard" look, the crew shows as a row in the CGP Effort bar instead ("✦ CGP Crew", the title, the status, the track, "Crew n", ✕), so there is one bar above the prompt. With CGP Effort set to "Minimal", an older CGP Effort, or none, the crew draws its own bar.

## The panel

The panel opens by itself once per job, when the plan is shown or the first crew worker starts. If the person closes it, it stays closed for that job. "Crew n" in the bar and `/crew-panel` open and close it.

| In the panel | Meaning |
|---|---|
| The head | The title, the status, the track, and the totals: estimated cost, tokens, time and the number of workers. |
| "On it · n" | Running workers. |
| "Finished · n" | Finished workers, folded with ▸ and opened with ▾. |
| "Up next · n" | Planned tasks no worker has picked up yet, with the role and what they wait for. |
| "Compact" / "Expand" | Shows all workers as a row of symbols with the totals, or as full cards. |

Each worker card has a symbol in its role's colour that moves while it works (a compass for the architect, a magnifier for the investigator, a gear for the engineer, rising bars for the builder, a bolt for the runner), the task title, the role, model and effort, "round 2" on a second round, and its status: running, done, failed, stopped or ended. With reduced motion turned on, the symbols stay still.

Workers report their own steps, so a card can show "3/5 · escaping quotes" with a bar in the role's colour. A worker that reports no steps shows its context use instead, in grey. The bottom line of a card shows the context share, tokens, estimated cost and time.

The panel recognises a worker by its Agent description, which the lead sets to the task's title word for word. Any other subagent of the session shows too, as an unknown worker. The panel keeps the newest 150 runs.

## Cost and context

Cost is estimated from each request's token counts and a fixed price table (USD per million tokens, from the Claude API price list of October 2026):

| Model | Input | Output | Cache read | Context |
|---|---|---|---|---|
| Fable | 10 | 50 | 0.25 | 1M |
| Opus 5.5 | 4 | 20 | 0.2 | 1M |
| Sonnet 5.5 | 2 | 10 | 0.2 | 1M |
| Haiku 5.5 | 0.1 | 0.5 | 0.01 | 1M |

Cache writes count at the 5-minute rate, 1.25 times the input price. An unknown model is priced like Opus 5.5. The figures are a guide, not a bill.

## Reliability

Every 5 seconds the plugin checks running workers against Claude Code's own agent list. A worker that ended without the panel noticing, or whose process died, is marked "ended" instead of running forever; a fresh run gets 20 seconds before it counts as gone. A resumed session checks its runs on start.

In a session without a screen, such as `claude -p` or the SDK, the bar and the panel stay out of the way and progress reports still succeed.

## Commands and tools

| Name | What it does |
|---|---|
| `/cgp-crew:cgp-crew <job>` | Starts a crew job. |
| `/crew-panel` | Opens or closes the panel. |
| `/crew-panel hide` | Hides the bar until the next report. |
| `mcp__cgp-crew__progress` | The lead's report: title, tasks with roles and dependencies, phase, accepted tasks, finished. |
| `mcp__cgp-crew__step` | A worker's own steps: done, total and a short note. |

## Data and costs

The crew runs in the person's own Claude Code session and its subagents, on the person's own account; each worker's tokens cost what its model costs. The plugin sends nothing anywhere else. The panel's cost figure is computed locally from the token counts.

## Troubleshooting

| What the person sees | What to do |
|---|---|
| The lead says the crew agents are missing | Reinstall the plugin and restart, so the five agents load. |
| A task never moves on the track | Its Agent description did not match the task title. The lead should delegate again with the exact title. |
| A worker shows "running" after it ended | Wait up to 5 seconds for the check against the agent list. |
| Two bars above the prompt | Update CGP Effort to 1.1 or later and set its look to "Dashboard". |
| "The crew panel needs the terminal or the desktop app." | The session has no screen (`claude -p`, the SDK). |
| `/crew-panel` is unknown in the terminal | Add `{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }` to `~/.claude/settings.json` and restart. |
| Bugs | Open an issue on `crypto-gameplan/cgp-crew`. |
