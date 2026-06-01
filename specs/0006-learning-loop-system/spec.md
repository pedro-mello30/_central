# Spec 0006 — Learning Loop System

Status: draft (2026-06-01)
Increment: 0006
Depends on: 0001, 0002, 0003, 0004, 0005

## Goal

Turn the Daily Command Center from an isolated routine into the read-surface of a closed
six-part loop around one git-tracked store, `_central/state/`. Add the smallest possible
engine surface — a `state` core module and an `apply` command — and author the routines
that capture, classify, curate, and guard the loop. Every routine stays read-only; the
only writer is the explicit `apply` command.

See `docs/plans/2026-06-01-learning-loop-system-design.md` for the full design and the
decisions behind it.

## Background

Six components, one loop:

| # | Component | Role |
| --- | --- | --- |
| 01 | Granola | Captures meetings (objections, discoveries, follow-ups). |
| 02 | Learning Loop | Classifies signals as learning / hypothesis / decision (or routes a task). |
| 03 | _central | Holds operational state that must survive the chat. Source of truth. |
| 04 | DCC | Shows only what changes today. |
| 05 | Watchdog | Checks routines are fresh and recording correctly. |
| 06 | Weekly Review | Promotes, demotes, archives, or corrects learnings. |

Invariants carried from the engine: routines never write (`write_allowed: false`);
observed is not persisted (propose → `apply`); git is the audit log; `_central` is the
source of truth and Linear is only a mirror.

## Scope (in)

### state/ store + schema

- `state/learnings.jsonl` — mutable record set, one JSON object per line, **knowledge only**
  (`kind: learning|hypothesis|decision`). Not append-only; status flips in place, git holds
  history.
- `state/decisions.md` — generated projection of `kind:decision` records (never authoritative).
- `state/index.yaml` — freshness/health + counts, recomputed by `apply`.
- `state/schema/learning.json` — JSON Schema enforcing the record shape and **per-kind status**:
  - `learning` / `hypothesis`: `candidate | promoted | archived | rejected`
  - `decision`: `active | archived`
  - invalid combinations (e.g. `decision/candidate`) are structurally rejected.
- Record fields: `id`, `created`, `kind`, `status`, `text`, `origin`, `supersedes`,
  `last_transition: { at, actor, reason, op_id }`.
- Corrections write a **new** record with `supersedes: <old_id>` and archive the old one.

### core/state.ts (new engine module)

Pure functions (strings in / strings out, no hidden I/O), mirroring `core/memory.ts`:
- `addRecord`, `transition`, `correct`, `routeTask` (to Linear payload), `reindex`
  (recompute `index.yaml`), `projectDecisions` (regenerate `decisions.md`).
- Per-kind status validation; refuses invalid transitions.

### apply command (new, in run.ts)

- `run.ts apply <routine> [--entry N] [--op M] [--all] [--dry-run]`.
- Reads the routine's latest `proposals[]`, validates each against `state/schema/learning.json`,
  applies in order, prints a diff. `--dry-run` writes nothing.
- Supported ops: `add`, `transition`, `correct`, `task` (→ Linear mirror), `reindex`.
- Writes confined to `state/**`; never auto-commits.

### routines

- `routines/granola-capture/` *(new)* — intake of Granola notes; output raw captured items
  with `origin`. No classification.
- `routines/learning-loop/` *(new)* — classify signals → `proposals[]`
  (`add` records + `task` ops). Uncertain → `hypothesis/candidate`, never self-promoted.
- `routines/watchdog/` *(new)* — read `index.yaml` + routines' `memory.md`; check SLA
  freshness, schema validity, orphan `supersedes`, count reconciliation; output health report
  + `reindex` proposals.
- `routines/daily-command-center/` *(modify)* — add `state/` source; show promoted records as
  trusted, candidates/hypotheses as candidates; today-only filter unchanged.
- `routines/weekly-review/` *(repurpose)* — read full `state/`; output `transition`/`correct`
  proposals with a `reason`.

### tests

- `core/state.ts` unit tests (add/transition/correct/validation/projection/reindex).
- `apply` tests (`--dry-run` no-op, invalid refused, `task`→Linear-not-JSONL, writes confined
  to `state/`).
- One `.test.ts` per new/changed routine (ok + bad fixtures, via `MockAdapter`).

## Scope (out)

- Live connector credentials/wiring for Granola and Linear — host runtime concern.
- Auto-commit of `apply` output — every write stays a manual git change.
- Event-sourcing of `learnings.jsonl` — explicitly rejected (mutable + git instead).
- Any change to `contract`, `compose`, `validator`, `runner`, `preflight`, `guards` — `apply`
  lives outside the run path; if a routine needs an engine change, that is a separate spec.

## Acceptance criteria

- [ ] `state/schema/learning.json` rejects an invalid `kind`/`status` combo (e.g. `decision/candidate`)
      and accepts each valid one.
- [ ] `core/state.ts`: `add` stamps `id`+`created`; `transition` flips status + `last_transition`
      in place; `correct` creates a new record that `supersedes` the old and archives the old;
      `reindex` recomputes `index.yaml` counts; `projectDecisions` regenerates `decisions.md`
      deterministically.
- [ ] `run.ts apply <routine> --dry-run` writes nothing (no diff to `state/`); without it, the
      ops land and a diff is printed.
- [ ] A `kind:task` proposal routes to a Linear payload and **never** appears in `learnings.jsonl`.
- [ ] `apply` refuses any write path outside `state/**`.
- [ ] Each routine loads + validates against the engine contract; `--model mock` exits 0 with all
      sections; `--variant bad` exits 1 with `## ⚠️ Failures`.
- [ ] DCC and Weekly Review still run `write_allowed: false`; the run path is unchanged.
- [ ] `npm run typecheck` and `npm test` pass.

## Verification

```
npm run typecheck
npm test
npx tsx run.ts run granola-capture --model mock
npx tsx run.ts run learning-loop   --model mock
npx tsx run.ts apply learning-loop --dry-run
npx tsx run.ts run watchdog        --model mock
npx tsx run.ts run daily-command-center --model mock
npx tsx run.ts run weekly-review   --model mock
npx tsx run.ts apply weekly-review --dry-run
```
