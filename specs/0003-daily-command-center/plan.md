# Plan 0003 — Daily Command Center

Almost entirely authoring a routine folder; the engine already does the work.

## Order of work

1. **schema.json** — define the structured brief; enforce `top3` maxItems 3 + required keys.
2. **routine.yaml** — contract: schedule trigger, 5 sources w/ trust, criteria, guards.
3. **prompt.md** — operational-contract instructions, fixed section order, hypotheses rule.
4. **fixtures** — `response.ok.json` (valid brief) and `response.bad.json` (4 top3 items).
5. **memory.md** — seeded empty log.
6. **test** — `routines/daily-command-center/daily-command-center.test.ts`:
   load+validate, run mock ok (sections + top3 ≤ 3), run mock bad (visible failures).
7. **verify** — typecheck + test + manual run (ok + bad).

## Notes

- Keep the markdown in fixtures realistic so the rendered brief reads like a real
  one-screen founder briefing.
- The `bad` fixture must be *schema*-invalid (not merely ugly) so validation is the thing
  that catches it.
