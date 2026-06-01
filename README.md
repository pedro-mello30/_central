# _central

A **model-agnostic routine engine**. Define an operational loop once, vendor-neutrally,
and run it on any model runtime (Claude Code, Codex). <10% of logic lives in
model-specific adapters; >90% lives in shared, portable routine artifacts.

A routine follows the contract: **Trigger → Sources → Criteria → Output → Guardrails → Learning**.

## Layout

```
core/        engine: loader, contract (zod), compose, preflight, validator, runner,
             memory (read-back + promotion), schedule
adapters/    base interface + mock, claude, codex
routines/    one folder per routine: routine.yaml, prompt.md, schema.json, fixtures/, memory.md
run.ts       CLI entry (run / schedule / promote)
specs/       lightweight SDD — one folder per increment (source of truth)
docs/plans/  design docs
```

## Commands

```bash
npm install

# Run a routine on any model (mock | claude | codex)
npx tsx run.ts run example-echo --model mock --input name=Pedro
npx tsx run.ts run daily-command-center --model claude

# Emit an installable host crontab line from a routine's trigger.cron
npx tsx run.ts schedule daily-command-center --model claude

# Promote a memory hypothesis (candidate -> promoted); newest entry by default
npx tsx run.ts promote daily-command-center --hyp 0 [--entry 0]

# Apply a routine's last-run proposals to the state/ store (--dry-run to preview)
npx tsx run.ts run learning-loop --model claude
npx tsx run.ts apply learning-loop --dry-run
npx tsx run.ts apply learning-loop

# Roll the run log up into per-routine health (optional routine arg filters)
npx tsx run.ts metrics
npx tsx run.ts metrics daily-command-center
```

`run` is the default command, so `run.ts example-echo ...` also works.

The engine: reads recent `memory.md` as read-only context, loads + validates the routine,
composes a prompt, runs **preflight** checks, invokes the adapter, validates output against
`schema.json`, prints a result, and appends a structured entry to `memory.md` (capturing
the run's low-confidence items as `hypotheses`). Guardrails (`write_allowed: false`) are
enforced structurally — the engine never auto-writes or publishes. Failures are surfaced in
a visible `## ⚠️ Failures` section, never hidden. Hypotheses stay candidates until a human
`promote`s them (hypothesis ≠ truth).

Every run is observable: it carries a unique `runId` and timing, prints a structured
one-line summary to stderr (stdout stays the clean markdown pipe), and appends a compact
JSON record to the append-only run log at `runs/runs.jsonl` (git-ignored, tail-able):

```
run_20260601183836_3ea693 example-echo model=mock status=ok duration=78ms failures=0 hypotheses=0
```

`metrics` rolls that log up into per-routine operational health — run count, success
rate, p50/p95 duration, and total failures — read-only over the existing records:

```
routine               runs  ok%  p50   p95   fails
daily-command-center  42    95%  1.2s  3.1s  2
learning-loop         18    100% 0.4s  0.9s  0
```

## Develop

```bash
npm run typecheck
npm test
```

## Roadmap (incremental, spec-driven)

- **0001 — Agnostic engine core** ✅ (offline, mock adapter)
- **0002 — Real adapters** ✅ (`claude -p`, `codex exec`, reachability preflight)
- **0003 — Daily Command Center routine** ✅ (fixed-format founder brief, schema-enforced)
- **0004 — Scheduling + memory read-back loop** ✅ (cron mapping, memory context, promotion)
- **0005 — More routines** ✅ (Weekly Review, LinkedIn Radar — **zero engine changes**)
- **0006 — Learning Loop System** ✅ (`state/` store + `apply` writer; capture → classify →
  state → DCC → watchdog → weekly curation)

## Routines

| Routine | Trigger | Output sections |
| --- | --- | --- |
| `example-echo` | manual | greeting (engine smoke test) |
| `granola-capture` | `30 8 * * *` | captured items (objection / discovery / follow-up / decision) |
| `learning-loop` | `35 8 * * *` | proposals: add (learning/hypothesis/decision) + task→Linear |
| `daily-command-center` | `40 8 * * *` | Top 3 / Calendar / Follow-ups / Blocked / Problems (reads `state/`) |
| `watchdog` | `0 9 * * *` | freshness/integrity checks + reindex proposals |
| `weekly-review` | `30 7 * * 1` | lifecycle proposals: promote / demote / archive / correct |

The Learning Loop is a closed system around `state/` (the git-tracked source of truth:
`learnings.jsonl`, `decisions.md`, `index.yaml`). Routines stay read-only and **propose**;
the explicit `apply` command is the only writer. See
`docs/plans/2026-06-01-learning-loop-system-design.md`.

See `docs/plans/2026-06-01-central-design.md` for the full design.
