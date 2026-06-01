# Plan 0004 — Scheduling + Memory Loop

TDD, smallest pieces first. Memory parsing must round-trip what `appendMemory` writes, so
build/extend memory before the runner wiring that depends on it.

## Order of work

1. **schedule** — `core/schedule.ts` + test (line for DCC; throws for manual routine).
2. **memory parse/readback** — extend `core/memory.ts`: `parseMemory`, `readRecentMemory`,
   `formatRecentForPrompt`; tests round-trip appendMemory output.
3. **compose context** — optional `recentMemory` section; test determinism + absence.
4. **promotion** — `promoteHypothesis` + test (candidate moves to promoted, persisted).
5. **runner wiring** — read recent memory → compose; capture hypotheses from output into
   the appended entry; test capture + next-run context.
6. **CLI dispatch** — `run.ts`: `run` / `schedule` / `promote` subcommands.
7. **verify** — typecheck + full suite + manual schedule/run.

## Design notes

- `parseMemory`: split on `^## ` blocks; pull `status`, `hypotheses` (JSON), `promoted`
  (JSON), `notes`, and the header (timestamp/name/model).
- Hypothesis capture convention: prefer output JSON `hypotheses: string[]`; else map
  `problems: string[]`. Non-arrays ⇒ no capture. Keeps routines from needing a new field.
- `appendMemory` already accepts `hypotheses`; runner now fills it from output.
- Backward compatibility: compose's new arg is optional and additive.
