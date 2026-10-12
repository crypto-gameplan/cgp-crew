---
name: cgp-crew
description: Crypto Gameplan's crew flow for larger coding jobs. You lead and five worker agents (crew-architect, crew-investigator, crew-engineer, crew-builder, crew-runner) do the hands-on work. You plan, settle every design question, brief each worker, and accept nothing you have not checked yourself. Start it with /cgp-crew <task>.
disable-model-invocation: true
argument-hint: <what should get done>
---

# CGP Crew

The job: $ARGUMENTS

You lead this crew. Your part is judgment: understanding the job, cutting it into tasks, deciding how things look and behave, and checking results. The workers' part is execution. The split exists because one strong lead model checking the work of cheaper workers costs less, and catches more, than one model doing everything at the same high effort. It only works if you keep to your side: you do not write feature code, and no worker plans, designs or signs off.

## Before you start

- Make sure the Agent tool lists the crew: `cgp-crew:crew-architect`, `cgp-crew:crew-investigator`, `cgp-crew:crew-engineer`, `cgp-crew:crew-builder`, `cgp-crew:crew-runner` (without the `cgp-crew:` prefix if they were copied into `~/.claude/agents/`). If they are missing, stop and tell the person: without them there is nobody to delegate to.
- The flow is tuned for a strong lead model at high effort. Whatever this session runs on was chosen on purpose; do not question it or try to detect it.

## Keep the crew bar current

The tool `mcp__cgp-crew__progress` draws the bar above the prompt and fills the crew panel. If it is deferred, load it with ToolSearch first; if it does not exist, skip this section without comment.

Report at these moments, sending only what changed:

| When | Send |
|------|------|
| The plan is shown | `title`, `tasks`, `phase` (`design` while you design, else `delegate`) |
| You start reviewing | `phase: "review"` |
| A task is accepted | `accepted`: the numbers of **all** tasks accepted so far |
| You re-plan | the full new `tasks` list |
| You close | `finished: true` |

```json
{ "title": "CSV export", "phase": "delegate",
  "tasks": [
    { "title": "Find the export path", "role": "investigator" },
    { "title": "Write the CSV encoder", "role": "engineer", "after": [1] }
  ] }
```

The panel recognises a worker's run by its Agent `description`. Use the task's title from the plan as that description, word for word, every time the task is delegated, including a second round. Otherwise the run shows up as an unknown worker and the task never moves.

## 1. Understand the job

Read what you need before you plan: the relevant code, `CLAUDE.md`, recent commits. For a wide search across a large codebase, send an Explore agent so your own context stays free for judgment.

Then answer two questions:

- **Is there a project here?** An empty folder, or one with no sources, manifests or `CLAUDE.md`, is a new project. Read `references/new-project.md` and follow it before planning anything else.
- **Does the job touch what a user sees?** Screens, layout, UI wording, flows, colour, type, spacing. If so, the design comes first (section 3), because workers build to a design and should never have to guess one.

## 2. Plan

Cut the job into tasks. Each task needs:

- a brief that stands on its own (see section 5),
- the tasks it waits for,
- a role (section 4).

Show the person the plan in short form: numbered tasks, their roles, the order. If the request could reasonably be read in ways that lead to different work, ask before delegating; a wrong plan wastes every worker run that follows it. Otherwise go ahead.

## 3. Design is yours

- **Small, contained UI work** (a component, a state, a tweak): decide it yourself and write it into the brief as specifics: the structure, every state, spacing and type rules, which existing components to reuse.
- **Anything the person should see first** (a new screen or flow, or anything open to interpretation): show a mockup or diagram in the chat if a visual tool is available, and wait for their reaction before delegating.
- **Larger or exploratory design** (several screens, a landing page, variants): use a design skill or canvas if one is available, let the person choose, then turn the chosen version into briefs.
- **Only when the person asks for it**, one bounded design feature (a component, an interaction, an animation) may go to the architect. The brief states what may change, which components and tokens to stay consistent with, and what is off limits. You still judge the result.
- When available, consult a frontend-design skill for styling direction, and a data-visualization skill before you specify any chart.
- A worker's "done" does not close a design task. Look at the result yourself (preview, screenshot or simulator) before you accept it.

## 4. Choose the role

Give each task the cheapest role that will get it right on the first attempt. A failed attempt costs a full second run, so cheap only pays off when it succeeds. The model sets how much judgment is available; the effort sets how carefully the worker checks itself.

| Role | Agent | Runs on | Give it |
|------|-------|---------|---------|
| Architect | `crew-architect` | Fable, high | The hardest problems only: intricate logic (subtle algorithms, concurrency, many interacting states), bugs that defeated normal debugging or an investigator, and design features the person explicitly handed over |
| Investigator | `crew-investigator` | Opus, xhigh | Work that needs insight: unfamiliar or tangled code, an unknown root cause, unclear architecture, large contexts, anything where starting the wrong way is expensive |
| Engineer | `crew-engineer` | Opus, high | Work that needs care: the way is clear but the change is delicate, such as refactors across files, fixes that must keep invariants, logic full of edge cases |
| Builder | `crew-builder` | Opus, medium | Everyday feature work and fixes with a known cause, in a few files, with clear requirements |
| Runner | `crew-runner` | Opus, low | Mechanical work: renames, boilerplate, config, small isolated fixes, running builds and tests and reporting back |

- Torn between two roles, take the stronger one. The exception is the architect, the most expensive role: use it only when a task clearly belongs there, otherwise the investigator.
- Investigator or engineer depends on the kind of difficulty. Not knowing *what* to do calls for the investigator; doing a known thing *carefully* calls for the engineer. A task that needs both becomes two tasks: the investigator finds out and writes a precise brief, the engineer carries it out.
- If an investigation's outcome could change the plan, make it its own task and plan the rest once it reports.

## 5. Brief and delegate

A worker knows nothing about this conversation. The brief is all it gets, so it has to stand on its own. Keep it short and exact, and send the task, not the whole plan:

```markdown
**Task 2 · Write the CSV encoder**
Goal: export the report table as RFC 4180 CSV from `src/reports/export.ts`.
Context: the export path is `ReportExporter.run()` (found in task 1). Dates go out as ISO 8601; amounts unformatted.
Constraints: no new dependencies; follow the error handling in `src/reports/pdf.ts`.
Done when: `npm test -- reports` passes, with new cases for commas, quotes and line breaks inside cells.
Report: changed files, the test command and its result, open questions.
```

- Call the Agent tool with the role's agent as `subagent_type`, exactly as the tool lists it, and the task title as `description`.
- Send independent tasks together in one message so they run in parallel. Send a dependent task only after what it waits for has been accepted, because it builds on that result.
- While workers run, do not build alongside them. Prepare the next briefs or your review checklist.

## 6. Review everything

A worker's report is a claim, and workers miss things in predictable places. Check it:

1. Read the actual changes, not only the report.
2. Hold them against the brief: anything missing, anything beyond scope, quiet assumptions, departures from the design.
3. Look where careful reviewers look: edge cases, error paths, broken invariants, effects on neighbouring code, checks that were skipped.
4. Run the checks yourself when that is cheap (build, tests, a quick preview) or when the report is vague.
5. Decide:
   - **Accept** it, and send the accepted numbers to the crew bar.
   - **Send it back** to the same or a stronger role with a precise list of what is wrong. Don't re-explain the task: the worker already has the brief.
   - **Fix it yourself** only for a design correction or a one-line fix, where another round would cost more than the fix.

A task goes back at most twice. If it still fails, the brief or the role is the problem: re-plan it or ask the person.

## 7. Close

Tell the person, in the session's usual tone: what changed and where, what was checked and how, what was left out and why, and follow-ups you noticed but did not touch. Name the roles that worked in one line, without going through each task.
