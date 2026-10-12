# cgp-crew

A Claude Code plugin: the `/cgp-crew` skill, five worker agents in `agents/`, and a function-hooks mod for the crew bar and panel.

- Validate: `claude plugin validate .`
- Test: `claude plugin test .`
- Type-check: `tsc -p .` once `.claude-plugin/types/` exists, which happens after the mod has loaded once with `claude --plugin-dir .`

Layout of `hooks/`:
- `register.tsx` holds every hook, the `$.state` atoms and every `$` call. The validator follows `$` and atoms only inside this file, so they stay here.
- `core/` is pure logic: `flow` (reports, segments), `runs` (run lifecycle, reconcile), `roles`, `models` (prices), `format`, `tools`, `strings`, `palette`.
- `ui/` is pure drawing. `band.tsx` and `pane.tsx` take a `*Draw` object of elements, state and callbacks from `register.tsx`; `svg.ts` has the shared styles and the task track; `symbols.ts` has the role symbols and the CGP mark.

Conventions:
- UI text is English and lives in `hooks/core/strings.ts`.
- SVG is drawn only when `e.surface === 'desktop'`. The terminal lists an `Svg` element but does not paint it.
- Any `$.ui` call that a report or a spawn depends on is wrapped, because sessions without a surface have no panes.
- The role names `architect`, `investigator`, `engineer`, `builder` and `runner` must match across `agents/`, `skills/cgp-crew/SKILL.md`, `core/tools.ts`, `core/roles.ts` and `ui/symbols.ts`.
- Tool names are `mcp__cgp-crew__progress` and `mcp__cgp-crew__step`. Renaming the plugin renames them.
- Prices in `core/models.ts` follow the Claude API price list; update them when it changes.
- Shared bar with cgp-effort: `core/feed.ts` writes `cgp-crew.feed` (format `FEED_VERSION`); cgp-effort answers with `cgp-effort.crewHost` and passes presses back through `cgp-effort.crewRequest`. Change the feed shape only together with a new version.
