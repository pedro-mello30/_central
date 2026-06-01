# CLAUDE.md

Guidance for agents and humans working in this repo. `_central` is a
**model-agnostic routine engine**: define an operational loop once (vendor-neutral)
and run it on any model runtime. >90% of logic lives in portable routine artifacts;
<10% in model-specific adapters.

## Bootstrap

Requires **Node >= 20.12** (the Vitest 4 toolchain imports `node:util#styleText`).

```bash
make setup     # verify Node version + npm ci
make check     # full local gate: typecheck + lint + format + test + audit (mirrors CI)
```

`make help` lists every target. Everything wraps the npm scripts in `package.json`,
so `npm run <script>` works too if you prefer.

## Layout

```
core/        engine: contract (zod), compose, preflight, validator, runner,
             memory (read-back + promotion), schedule, store, runlog
adapters/    base interface + mock, claude, codex
routines/    one folder per routine: routine.yaml, prompt.md, schema.json, fixtures/, memory.md
run.ts       CLI entry (run / schedule / promote / apply)
specs/       lightweight SDD — one folder per increment (spec.md is source of truth)
docs/plans/  design docs
```

## Running routines

```bash
make run R=daily-command-center M=mock      # M = mock | claude | codex
make schedule R=daily-command-center M=claude
make apply R=learning-loop DRY=1            # preview; drop DRY=1 to persist
make promote R=daily-command-center HYP=0
```

## Conventions & guardrails

- **The routine contract is fixed:** `Trigger → Sources → Criteria → Output → Guardrails → Learning`.
- **No autonomous writes.** Routines declare `write_allowed: false`; persisting is an
  explicit, separate, human-invoked `apply` step (supports `--dry-run`). Preserve this.
- **Human-in-the-loop promotion.** Low-confidence items are recorded as `hypotheses`
  and stay candidates until a human `promote`s them.
- **No shell string interpolation.** External CLIs are invoked via `spawn(cmd, args[])`.
- **No secrets in-repo.** `runs/`, `.last-run.json`, and `*.log` are git-ignored.
- See `SECURITY.md` for the full trust model before changing the engine.

## Before opening a PR

Run `make check` — it must pass clean. CI runs the same steps on Node 20.x.
Specs in `specs/` are the source of truth; keep them in sync with engine changes.
