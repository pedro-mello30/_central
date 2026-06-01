# Spec 0004 — Scheduling + Memory Loop

Status: accepted (implemented + verified 2026-06-01)
Increment: 0004
Depends on: 0001, 0002, 0003

## Goal

Close the **Learning** leg of the routine contract and add **triggering**. Three pieces,
all model-agnostic:

1. **Schedule mapping** — translate a routine's `trigger.cron` into an installable host
   crontab line that invokes `run.ts`. Execution stays on the host's cron/scheduler
   (vendor-neutral); `_central` only emits the line.
2. **Memory read-back** — feed recent `memory.md` entries into the composed prompt as
   read-only context, so each run learns from prior ones (iterative loop).
3. **Hypothesis promotion** — capture low-confidence items from a run's output into the
   memory entry as `hypotheses` (candidates), and provide a `promote` command that a
   human uses to move a candidate into `promoted` (hypothesis ≠ truth).

## Background

Briefing: routines are loops that "learn iteratively"; hypotheses stay candidates until a
human promotes them; failures are visible. See `docs/plans/2026-06-01-central-design.md`.

## Scope (in)

- `core/schedule.ts` — `crontabLine(loaded, { model, repoDir, logDir? })` returns a cron
  line (`<cron> cd <repo> && npx tsx run.ts <name> --model <model> >> <log> 2>&1`).
  Errors clearly if the routine's trigger is not `schedule` or has no `cron`.
- `core/memory.ts` (extend):
  - `parseMemory(text)` → structured `MemoryRecord[]`.
  - `readRecentMemory(loaded, n)` → the last `n` records.
  - `formatRecentForPrompt(records)` → a compact read-only context block.
  - `promoteHypothesis(loaded, { entryIndex?, hypothesisIndex })` → move one candidate
    from `hypotheses` to `promoted` in the target entry (default: latest), rewrite file.
- `core/compose.ts` (extend) — optional `{ recentMemory?: string }` arg adds a
  "## Recent memory (read-only context)" section. Absent ⇒ behavior unchanged.
- `core/runner.ts` (extend):
  - before composing, read recent memory and pass it to `compose`.
  - after running, capture hypotheses from the output (convention: output JSON's
    `hypotheses` array, else its `problems` array of strings) into the appended entry.
- `run.ts` (extend) — a tiny command dispatcher:
  - `run <routine>` (default when first token isn't a known command)
  - `schedule <routine> [--model claude]` → prints the crontab line
  - `promote <routine> [--entry N] --hyp N` → promotes a candidate, prints the result
- Tests for schedule, memory parse/readback/promote, compose context, and a runner test
  proving captured hypotheses land in memory and feed the next run.

## Scope (out)

- A long-running daemon / in-process scheduler — host cron owns execution.
- Auto-promotion of hypotheses — promotion is always a human action.
- API / GitHub trigger execution surfaces — only `schedule` is mapped here; the contract
  already models the other trigger types for future increments.

## Memory entry format (parseable)

```
## 2026-06-01T08:40:00Z — daily-command-center (claude)
- status: ok
- hypotheses: ["Lead X looks stale — verify?"]
- promoted: []
- notes: calendar quiet
```

`hypotheses` and `promoted` are JSON arrays; `parseMemory` reads them back.

## Acceptance criteria

- [ ] `crontabLine` produces a correct line for `daily-command-center` and throws for a
      non-schedule routine (e.g. `example-echo`, trigger `manual`).
- [ ] `parseMemory` round-trips entries written by `appendMemory` (status, hypotheses,
      promoted, notes).
- [ ] `readRecentMemory(loaded, n)` returns the most recent `n` records, newest first.
- [ ] `composePrompt(..., { recentMemory })` includes the context section; without it the
      output is byte-identical to before.
- [ ] The runner captures a routine output's `problems`/`hypotheses` into the memory
      entry, and a subsequent run includes them as prompt context.
- [ ] `promoteHypothesis` moves a candidate from `hypotheses` to `promoted` in the target
      entry and persists it.
- [ ] `run.ts schedule daily-command-center --model claude` prints an installable line;
      `run.ts promote ...` promotes a candidate.
- [ ] `npm run typecheck` and `npm test` pass; existing tests unchanged in behavior.

## Verification

```
npm run typecheck
npm test
npx tsx run.ts schedule daily-command-center --model claude
npx tsx run.ts run example-echo --model mock --input name=Pedro
```
