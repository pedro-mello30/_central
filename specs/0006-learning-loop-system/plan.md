# Plan 0006 — Learning Loop System

First increment to add an engine surface since 0002. Build the writer and the store before
the routines that feed it, so each routine can be verified against a working `apply`.

## Order of work

1. **state schema** — `state/schema/learning.json` (record shape + per-kind status `if/then`).
2. **core/state.ts** — pure add / transition / correct / routeTask / reindex / projectDecisions,
   with per-kind validation. Unit-tested first (TDD).
3. **apply command** — `cmdApply` in `run.ts` (the I/O shell over core/state.ts): read proposals,
   validate, apply, diff, `--dry-run`. Tested with a tmp `state/`.
4. **learning-loop** — schema → routine.yaml → prompt.md → fixtures (ok/bad) → memory → test.
   Emits `add` + `task` proposals.
5. **granola-capture** — same pattern; raw capture, no classification.
6. **watchdog** — same pattern; reads index.yaml + memory; emits health + `reindex`.
7. **daily-command-center** — add `state/` source; render promoted vs candidate; update fixtures
   + test (today-only filter unchanged).
8. **weekly-review** — repurpose into curator; output `transition`/`correct` proposals; update
   fixtures + test.
9. **verify** — typecheck + full suite + the manual runs in spec Verification; confirm the run
   path (contract/compose/validator/runner/preflight/guards) is unchanged.

## Notes

- `core/state.ts` keeps the `memory.ts` discipline: no hidden I/O in the logic; the command is
  the only place that touches disk.
- `bad` fixtures must fail on a *schema* rule so validation is what catches them — same as 0003/0005.
- `apply` is outside the run path on purpose; do not relax `write_allowed` on any routine.
- `task` routing produces a Linear payload only — assert it never reaches `learnings.jsonl`.
- `decisions.md` and `index.yaml` are always *generated*; never hand-edit them in fixtures.
- This increment DOES change `core/` and `run.ts` (unlike 0005) — that is expected and scoped to
  `core/state.ts` + `cmdApply`.

## Risks

- **Proposal source of truth.** `apply` reads proposals from the routine's latest run. If a run
  artifact isn't persisted richly enough, `apply` has nothing to read — confirm the runner records
  the `proposals[]` (or save a proposal artifact) before building `apply`.
- **Linear routing without a connector in tests.** Mock the Linear target in `apply` tests; live
  wiring is out of scope (host concern).
