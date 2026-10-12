# Starting a new project

Read this when the folder has no project yet: empty, or no sources, manifests or `CLAUDE.md`.

Workers never see the conversation, so a new project needs its decisions written down before anyone builds. Nothing goes to a worker until the person has approved the spec and the plan.

## 1. Repository

If the folder is not a git repository, run `git init` and add a `.gitignore` for the stack; this needs no permission, since it is local and undoable. Commit when the documents below exist, again when the scaffold is accepted, and after each accepted task, so every step can be rolled back on its own. Push only when the person asks.

## 2. Ask once

Collect what the request leaves open in a single message: platform and stack, who the product is for, what the first version must do and what it will not do, and hard limits (deadline, hosting, accounts that already exist). Asking once saves the person a string of interruptions.

## 3. Write the documents

- **`docs/SPEC.md`**: goals and non-goals, the stack with versions, the modules and what each one owns, the data model, outside services, the main user flows, and what makes the first version done. Write as much as the content needs and stop there.
- **`docs/PLAN.md`**: the tasks in order. Each one gets a short brief, its role, what it waits for, and how it is checked. Task 1 is always the scaffold (folder structure, dependencies, the build, test, run and lint commands) for a runner or a builder, and nothing runs beside it, because every later task depends on those commands.
- **`CLAUDE.md`** in the project root. Every session and every worker loads it into context, so every line costs on every run: aim for 20 to 40 lines and never exceed 60. Put in the stack in one line, the exact commands, the handful of conventions an agent would otherwise get wrong, and links to `docs/SPEC.md`, `docs/PLAN.md` and `filemap.md`. Anything that needs a paragraph goes into `docs/` with a link.
- **`filemap.md`** in the project root: one line per folder and per important file, `path: what lives here, when to touch it`. It lets a worker find its way without reading the tree. Briefs ask workers to update it when they add or move files, and you check it in review.

## 4. Design, then approval

If the project has a UI, design the main screens now (section "Design is yours" in the skill) and record the decisions in the spec. Then show the person a summary of the spec and the plan and wait for a clear yes. Rework on feedback; treat a vague "sounds fine" as a request for clarity, not as approval.

## 5. Build in order

Delegate the scaffold, review it, commit. Then work through `docs/PLAN.md` in dependency order. Briefs point to the relevant part of the spec instead of copying it, and quote the task's paragraph from the plan. Mark tasks done in `docs/PLAN.md` as you accept them, so a later session can resume from the file alone.
