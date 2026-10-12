# CGP Crew

A Claude Code plugin by [Crypto Gameplan](https://github.com/crypto-gameplan). You give a coding job to `/cgp-crew:cgp-crew`, and your session leads a crew of five worker agents through it. The session plans the job, decides the design, writes a brief for each task and checks every result before it counts. The workers write the code.

While the crew works, a bar above the prompt shows the plan as one segment per task, and a panel lists every worker with its model, progress, context use, cost and time.

## Install

CGP Crew is listed in the Crypto Gameplan marketplace ([crypto-gameplan/cgp-marketplace](https://github.com/crypto-gameplan/cgp-marketplace)). In Claude Code, run:

```text
/plugin marketplace add crypto-gameplan/cgp-marketplace
```

```text
/plugin install cgp-crew@crypto-gameplan
```

Then run `/reload-plugins` or restart Claude Code.

## Use it

```text
/cgp-crew:cgp-crew add a CSV export to the reports page
```

The session reads the relevant code and shows you a numbered plan with a role for each task. If any UI is involved, it settles the design first and may show you a mockup. Independent tasks run in parallel. After each task the session reads the diff, runs the checks again and either accepts the work or sends it back with a list of what is wrong. A task goes back at most twice. At the end you get a summary of what changed, what was tested and what was left out.

In an empty folder the session sets the project up before any worker starts. It runs `git init` and writes `docs/SPEC.md`, `docs/PLAN.md`, a short `CLAUDE.md` and `filemap.md`, then waits for your approval.

The lead does its best work on a strong model at high effort. Each worker sets its own model and effort.

## The crew

| Role | Model and effort | Gets |
| --- | --- | --- |
| Architect | Fable, high | The hardest problems, and design work only when you ask for it |
| Investigator | Opus, xhigh | Unfamiliar code and bugs with an unknown cause |
| Engineer | Opus, high | Delicate changes with a clear approach: refactors, invariants, edge cases |
| Builder | Opus, medium | Everyday features and fixes with a known cause |
| Runner | Opus, low | Renames, config, boilerplate, running builds and tests |

## The bar and the panel

The bar shows the CGP mark, the job's title, one segment per task and where the lead stands, for example "Reviewing 3/5". A segment fills in the role's colour once the task is accepted. It pulses while a worker is on it, shows half-filled when the work is waiting for review, and turns red when a run failed. The mark's bars build up while workers run.

Press the crew button next to the bar, or run `/crew-panel`, to open the panel. Running workers are listed first, then finished ones, then the tasks nobody has picked up yet. Each worker has a symbol in its role's colour that moves while it works: a compass for the architect, a magnifier for the investigator, a gear for the engineer, rising bars for the builder and a bolt for the runner. With reduced motion turned on, the symbols stay still.

Workers report their own steps, so the panel can show "3/5 · escaping quotes" under a task. A worker that reports no steps shows its context use instead, in grey.

Cost is estimated from token counts and the Claude API price list, so treat it as a guide rather than a bill.

## Together with CGP Effort

With [CGP Effort](https://github.com/crypto-gameplan/cgp-effort) 1.1 or later in its Dashboard look, the crew shows in a row of the CGP Effort band instead of a bar of its own, so there is one band above the prompt. The crew button there opens the crew panel and the ✕ hides the row. With CGP Effort set to Minimal, an older CGP Effort, or no CGP Effort at all, the crew draws its own bar as described above.

## Reliability

The panel checks running workers against Claude Code's own agent list every few seconds. A worker that ended without the panel noticing, or whose process died, is marked as ended instead of showing "running" forever. In a session with no screen, such as `claude -p` or the SDK, the bar and panel stay out of the way and progress reports still succeed.

The bar and panel are built on Claude Code's function hooks, an early-access API that can change between releases.

## Development

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

The layout is described in [CLAUDE.md](CLAUDE.md).

## License

MIT
