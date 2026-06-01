# _central — Model-Agnostic Routine Engine — Design

Date: 2026-06-01
Status: validated (ready for implementation)

## Purpose

`_central` is a model-agnostic engine that runs **routines**: repeatable, trigger-based
operational loops that read sources, apply judgment criteria, and emit a fixed-format
output — runnable on any model runtime (Claude Code, Codex) without changing the routine.

Two reference inputs shaped this:

- **Research** (`docs/research/agnostic_routines.md`): keep <10% of logic in
  model-specific adapters, >90% in shared, vendor-neutral artifacts.
- **Briefing** (AI Automation Routines Workshop): "the new unit of work is the loop."
  Routines follow `Trigger → Sources → Criteria → Output → Guardrails → Learning`.
  Principles: read much / write little, output beats prompt, hypothesis ≠ truth,
  failures must appear in output.

## Core decisions

| Decision | Choice |
| --- | --- |
| Scope | Both — agnostic engine first, then real routines on top |
| Runtime | TypeScript / Node (adapters shell out to `claude` / `codex` CLIs) |
| Build process | Lightweight SDD — `specs/NNNN-*/{spec.md,plan.md,tasks.md}` per increment |
| Validation | zod (routine contract), jsonschema (output), vitest (fixtures as tests) |

## Architecture — three layers

1. **Contract layer (shared, ~90%)** — each routine is a folder of plain files:
   - `routine.yaml` — the contract (merged research + briefing shape, see below)
   - `prompt.md` — reusable task instructions ("operational contract")
   - `schema.json` — output validation
   - `fixtures/` — deterministic inputs + expected outputs for tests
   - `memory.md` — appended learning log

2. **Core engine (shared TS)** — `loader`, `validator`, `compose`, `preflight`,
   `runner`. Orchestrates: load → resolve inputs → compose prompt → preflight →
   invoke adapter → validate output → emit result → append memory.

3. **Adapter layer (<10%)** — `adapters/claude.ts` spawns `claude -p`,
   `adapters/codex.ts` spawns `codex exec`, plus a `mock` adapter for offline tests.
   One interface: `run(composedPrompt, opts) -> { raw, exitStatus }`. Nothing
   routine-specific lives here.

**Entry point:** `run.ts <routine-name> --model claude|codex|mock`. The engine never
auto-writes or publishes — `guards.write_allowed` is enforced structurally.

## The unified routine contract (`routine.yaml`)

```yaml
name: daily-command-center
version: 1
goal: One-screen founder brief with top priorities and blockers.

trigger:                    # briefing — vendor-neutral, adapters map it
  type: schedule            # schedule | api | github | manual
  cron: "40 8 * * *"

sources:                    # briefing — what's trustworthy to READ
  - id: gmail
    trust: source           # source | context | hypothesis
  - id: calendar
    trust: source

inputs: [date, timezone]    # research — resolved at runtime

tools:                      # research — capabilities the adapter must grant
  shell: false
  mcp: [gmail, gcal]
  web: false

criteria: |                 # briefing — explicit judgment rules
  Rank by deadline proximity then revenue impact. Max 3 in Top 3.

outputs:                    # research — output contract
  format: markdown+json
  schema: schema.json

guards:                     # research + briefing — read-heavy / write-narrow
  write_allowed: false      # never auto-publish
  forbidden_paths: ["infra/prod/**"]
  max_files_changed: 0

learning:                   # briefing — closes the loop
  memory: memory.md
  promote: human            # hypotheses stay candidates until a human promotes
```

`trigger`, `sources`, `tools`, `guards` are concepts both Claude Code and Codex honor;
each adapter maps them to its own surface. Nothing is vendor-specific.

## Run flow (`runner.ts`)

```
run.ts daily-command-center --model claude
  1. loader      → read routine folder, validate routine.yaml against zod schema
  2. resolve     → fill inputs (date, timezone, env/secrets refs)
  3. compose     → prompt.md + criteria + sources + output contract
  4. preflight   → cheap checks BEFORE the model:
                     • required sources reachable?
                     • guards coherent? (write_allowed=false ⇒ max_files_changed=0)
                     • prompt non-empty, schema parses
                   fail here ⇒ surface in output, never silently proceed
  5. adapter.run → spawn claude/codex; capture {raw, exitStatus}
  6. validate    → parse output, validate JSON block against schema.json
  7. emit        → write result (markdown for humans + json for machines)
  8. learn       → append structured entry to routine's memory.md
```

**Guardrails live in the engine, not the prompt.** Even if a model proposes a write,
`write_allowed: false` means the runner only reports proposed actions.

**Failures are first-class output** — preflight/validation failure produces a visible
`## ⚠️ Failures` section, never a hidden empty brief.

## Memory loop

Each run appends to `routines/<name>/memory.md`:

```markdown
## 2026-06-01 08:40 — daily-command-center (claude)
- status: ok
- hypotheses: ["Lead X looks stale — verify?"]   # candidates, not facts
- promoted: []                                     # humans move these up later
- notes: 2 sources empty (calendar quiet)
```

Hypotheses stay candidates until a human edits `promoted`. Next run reads recent
memory as context — iterative learning without auto-trusting AI guesses.

## Repo layout

```
_central/
  core/         loader.ts validator.ts runner.ts preflight.ts compose.ts types.ts
  adapters/     base.ts claude.ts codex.ts mock.ts        # the <10%
  routines/
    daily-command-center/  routine.yaml prompt.md schema.json fixtures/ memory.md
  run.ts                                                  # CLI entry
  specs/        0001-.../ 0002-.../ ...                   # SDD source of truth
  package.json tsconfig.json
docs/
  plans/2026-06-01-central-design.md                      # this design
  research/agnostic_routines.md
```

## Incremental SDD roadmap

Each increment is `specs/NNNN-*/{spec.md,plan.md,tasks.md}`, implemented + verified
against acceptance criteria before the next.

- **0001 — Agnostic engine core.** Types, loader, zod contract, validator, compose,
  runner skeleton + `mock` adapter (no real CLI). Acceptance: a fixture routine loads,
  composes, runs through mock, validates output, writes result + memory. Offline-testable.
- **0002 — Real adapters.** `claude.ts` (`claude -p`), `codex.ts` (`codex exec`),
  `--model` flag, preflight reachability checks. Acceptance: same routine runs on both.
- **0003 — Daily Command Center routine.** First real routine on the engine. Acceptance:
  fixed-format brief (Top 3 / Calendar / Follow-ups / Blocked / Problems), guards enforced.
- **0004 — Scheduling + memory loop.** Trigger→cron mapping, memory read-back as context,
  hypothesis promotion. Acceptance: scheduled run appends memory, next run consumes it.
- **0005 — More routines** (Weekly Review, LinkedIn Radar). Proves reuse, near-zero new
  engine code.

## Build discipline

TDD via fixtures, YAGNI (mock adapter before real CLIs so the engine is provable without
network/model), each increment independently verifiable.
