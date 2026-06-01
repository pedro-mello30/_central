# Spec 0003 — Daily Command Center Routine

Status: accepted (implemented + verified 2026-06-01)
Increment: 0003
Depends on: 0001, 0002

## Goal

Author the first real operational routine on the engine: the **Daily Command Center** —
the workshop's flagship use case. A one-screen founder brief that consolidates signals
into a fixed format (Top 3 / Calendar / Follow-ups / Blocked / Problems). This increment
adds **near-zero engine code** — it is almost entirely a routine folder, proving the
0001/0002 design. The routine is authored, validated, and exercised through the `mock`
adapter with fixtures; running it on `claude`/`codex` requires only the live CLIs +
configured sources.

## Background

From the briefing: the Daily Command Center is a fixed-format output (not a varied
response), an "operational contract" prompt, read-heavy / write-narrow, with failures
surfaced rather than hidden, and hypotheses kept as candidates until a human promotes
them. See `docs/plans/2026-06-01-central-design.md`.

## Scope (in)

- `routines/daily-command-center/routine.yaml` — the contract:
  - `trigger.type: schedule`, `cron: "40 8 * * *"` (08:40 daily; execution lands in 0004)
  - `sources`: gmail, calendar, crm, repos, tasks — each with a `trust` level
  - `inputs`: `date`, `timezone`
  - `criteria`: explicit ranking rules (deadline proximity, then revenue impact; max 3
    in Top 3; only items the founder can act on today)
  - `outputs.format: markdown+json`, `schema: schema.json`
  - `guards.write_allowed: false`, `max_files_changed: 0`
  - `learning.memory: memory.md`, `promote: human`
- `routines/daily-command-center/prompt.md` — the operational-contract task instructions,
  fixed section order, and the rule that uncertain items are `problems`/hypotheses.
- `routines/daily-command-center/schema.json` — JSON Schema for the structured payload.
- `routines/daily-command-center/fixtures/response.ok.json` — a representative brief.
- `routines/daily-command-center/fixtures/response.bad.json` — violates the schema
  (e.g. 4 items in `top3`) to prove validation rejects it.
- `routines/daily-command-center/memory.md` — seeded, empty learning log.
- A test that loads + validates the routine, runs it through the mock (ok + bad), and
  asserts the fixed-format contract (sections present, `top3` ≤ 3, failures visible).

## Scope (out)

- Scheduled execution / cron firing (→ 0004).
- Real source connectors (gmail/calendar/etc. live wiring) — runtime concern, configured
  on the host when running on claude/codex.
- Memory read-back as context (→ 0004).

## Output schema (shape)

```json
{
  "date": "2026-06-01",
  "top3":       [{ "title", "why", "source" }],          // maxItems 3
  "calendar":   [{ "time", "title" }],
  "follow_ups": [{ "who", "item", "age_days" }],
  "blocked":    [{ "item", "blocker" }],
  "problems":   ["string"]                                // failures + low-confidence items
}
```

`problems` is where preflight/source failures and low-confidence hypotheses surface, so
the brief is never silently empty.

## Acceptance criteria

- [ ] `routines/daily-command-center/` loads and validates against the engine contract.
- [ ] `outputs.schema` enforces `top3` maxItems 3 and the required section keys.
- [ ] `npx tsx run.ts daily-command-center --model mock` produces a brief with all five
      sections and exits 0.
- [ ] The `bad` fixture (4 items in top3) yields a visible `## ⚠️ Failures` section and
      a non-`ok` status.
- [ ] No engine/adapter source files change except, if needed, trivial additions.
- [ ] `npm run typecheck` and `npm test` pass.

## Verification

```
npm run typecheck
npm test
npx tsx run.ts daily-command-center --model mock
npx tsx run.ts daily-command-center --model mock --variant bad   # shows failures, exit 1
```
