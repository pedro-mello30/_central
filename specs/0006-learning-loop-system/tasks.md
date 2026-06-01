# Tasks 0006 — Learning Loop System

## state store + schema
- [ ] T1  state/schema/learning.json (record shape + per-kind status if/then)
- [ ] T2  state/learnings.jsonl (seed: empty/with header convention)
- [ ] T3  state/index.yaml (seed: schema_version + empty counts)
- [ ] T4  state/decisions.md (seed: generated-file header)

## core/state.ts (TDD)
- [ ] T5  core/state.test.ts — add stamps id/created
- [ ] T6  core/state.test.ts — transition flips status + last_transition in place
- [ ] T7  core/state.test.ts — correct: new record supersedes old, old archived
- [ ] T8  core/state.test.ts — per-kind status validation rejects decision/candidate
- [ ] T9  core/state.test.ts — reindex recomputes index.yaml counts
- [ ] T10 core/state.test.ts — projectDecisions regenerates decisions.md deterministically
- [ ] T11 core/state.ts — implement to pass T5–T10

## apply command
- [ ] T12 run.ts cmdApply — read proposals, validate, apply, diff
- [ ] T13 apply test — --dry-run writes nothing
- [ ] T14 apply test — invalid proposal refused with visible failure
- [ ] T15 apply test — task op routes to Linear payload, never to learnings.jsonl
- [ ] T16 apply test — writes confined to state/**

## learning-loop (new)
- [ ] T17 routines/learning-loop/schema.json (proposals[] of add|task)
- [ ] T18 routines/learning-loop/routine.yaml
- [ ] T19 routines/learning-loop/prompt.md (classify; uncertain -> hypothesis/candidate)
- [ ] T20 routines/learning-loop/fixtures/response.ok.json
- [ ] T21 routines/learning-loop/fixtures/response.bad.json
- [ ] T22 routines/learning-loop/memory.md
- [ ] T23 routines/learning-loop/learning-loop.test.ts

## granola-capture (new)
- [ ] T24 routines/granola-capture/schema.json (raw captured items + origin)
- [ ] T25 routines/granola-capture/routine.yaml
- [ ] T26 routines/granola-capture/prompt.md
- [ ] T27 routines/granola-capture/fixtures/response.ok.json
- [ ] T28 routines/granola-capture/fixtures/response.bad.json
- [ ] T29 routines/granola-capture/memory.md
- [ ] T30 routines/granola-capture/granola-capture.test.ts

## watchdog (new)
- [ ] T31 routines/watchdog/schema.json (health report + reindex proposals)
- [ ] T32 routines/watchdog/routine.yaml
- [ ] T33 routines/watchdog/prompt.md
- [ ] T34 routines/watchdog/fixtures/response.ok.json
- [ ] T35 routines/watchdog/fixtures/response.bad.json
- [ ] T36 routines/watchdog/memory.md
- [ ] T37 routines/watchdog/watchdog.test.ts

## daily-command-center (modify)
- [ ] T38 add state/ source; render promoted vs candidate
- [ ] T39 update fixtures (ok/bad) + test for the state-aware brief

## weekly-review (repurpose into curator)
- [ ] T40 schema.json — transition/correct proposals[]
- [ ] T41 routine.yaml + prompt.md — curator role over full state/
- [ ] T42 update fixtures (ok/bad) + test

## verify
- [ ] T43 npm run typecheck + npm test green
- [ ] T44 manual runs from spec Verification (run + apply --dry-run)
- [ ] T45 confirm run path unchanged (contract/compose/validator/runner/preflight/guards)
