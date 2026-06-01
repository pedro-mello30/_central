# Spec 0005 — More Routines (Weekly Review + LinkedIn Radar)

Status: accepted (implemented + verified 2026-06-01)
Increment: 0005
Depends on: 0001, 0002, 0003, 0004

## Goal

Author two more operational routines from the briefing — **Weekly Performance Review**
and **LinkedIn Radar** — entirely on the existing engine. The success measure is *reuse*:
**zero engine/adapter source changes**. Each routine is just a folder
(`routine.yaml` + `prompt.md` + `schema.json` + `fixtures/` + `memory.md`) plus a test.
This proves the 0001–0004 design: new value at near-zero marginal cost.

## Background

From the briefing's routine table:
- **Weekly Performance Review** — strategic planning loop, Mondays 07:30.
- **LinkedIn Radar** — daily signal capture (18:00) producing 3 weekly post angles.

Same contract as every routine: read-heavy / write-narrow, fixed output, failures visible,
hypotheses kept as candidates. See `docs/plans/2026-06-01-central-design.md`.

## Scope (in)

### routines/weekly-review/
- `trigger`: schedule, cron `"30 7 * * 1"` (Mondays 07:30).
- `sources`: metrics (source), crm (source), calendar (context), tasks (context).
- `inputs`: `date`, `timezone`.
- `criteria`: compare this week to last; cite numbers; max 3 focus items for next week;
  unknowns go to `risks`/`problems`, not invented wins.
- Output sections: **Wins / Metrics / Misses / Focus next week / Risks**.
- `schema.json` enforces required keys and `focus_next_week` maxItems 3.
- `guards`: `write_allowed: false`, `max_files_changed: 0`.
- fixtures: `response.ok.json`, `response.bad.json` (4 focus items → invalid).

### routines/linkedin-radar/
- `trigger`: schedule, cron `"0 18 * * *"` (daily 18:00).
- `sources`: linkedin (source), repos (context), news (context, trust level `hypothesis`).
- `inputs`: `date`, `timezone`.
- `criteria`: capture only signals seen today; produce exactly 3 post angles; never
  fabricate engagement numbers — uncertain items go to `problems`.
- Output sections: **Signals / Post angles (3) / Themes**.
- `schema.json` enforces `post_angles` with `minItems` 3 and `maxItems` 3.
- `guards`: `write_allowed: false`, `max_files_changed: 0`.
- fixtures: `response.ok.json`, `response.bad.json` (2 post angles → invalid).

### Tests
- One test per routine: loads + validates the contract; runs mock `ok` (sections present,
  array bounds honored, status ok); runs mock `bad` (visible failures, non-ok status).

## Scope (out)

- Any change to `core/` or `adapters/` — if a routine *needs* one, that is a separate
  spec. The whole point is to add none.
- Live source wiring (linkedin/metrics connectors) — runtime concern on the host.

## Acceptance criteria

- [ ] Both routines load + validate against the engine contract unchanged.
- [ ] `weekly-review` schema enforces `focus_next_week` maxItems 3; `bad` fixture fails.
- [ ] `linkedin-radar` schema enforces exactly 3 `post_angles`; `bad` fixture fails.
- [ ] `npx tsx run.ts run weekly-review --model mock` and `... linkedin-radar ...` exit 0
      with all their sections; `--variant bad` exits 1 with `## ⚠️ Failures`.
- [ ] `npx tsx run.ts schedule <routine> --model claude` emits the correct cron line.
- [ ] **git/diff shows no changes under `core/` or `adapters/`** for this increment.
- [ ] `npm run typecheck` and `npm test` pass.

## Verification

```
npm run typecheck
npm test
npx tsx run.ts run weekly-review   --model mock
npx tsx run.ts run linkedin-radar  --model mock
npx tsx run.ts schedule weekly-review --model claude
```
