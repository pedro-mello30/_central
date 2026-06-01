# Tasks 0006 — Learning Loop System

## state store + schema
- [x] T1  state/schema/learning.json (record shape + per-kind status if/then)
- [x] T2  state/learnings.jsonl (seed: empty/with header convention)
- [x] T3  state/index.yaml (seed: schema_version + empty counts)
- [x] T4  state/decisions.md (seed: generated-file header)

## core/state.ts (TDD)
- [x] T5  core/state.test.ts — add stamps id/created
- [x] T6  core/state.test.ts — transition flips status + last_transition in place
- [x] T7  core/state.test.ts — correct: new record supersedes old, old archived
- [x] T8  core/state.test.ts — per-kind status validation rejects decision/candidate
- [x] T9  core/state.test.ts — reindex recomputes index.yaml counts
- [x] T10 core/state.test.ts — projectDecisions regenerates decisions.md deterministically
- [x] T11 core/state.ts — implement to pass T5–T10

## apply command
- [x] T12 run.ts cmdApply — read proposals, validate, apply, diff
- [x] T13 apply test — --dry-run writes nothing
- [x] T14 apply test — invalid proposal refused with visible failure
- [x] T15 apply test — task op routes to Linear payload, never to learnings.jsonl
- [x] T16 apply test — writes confined to state/**

## learning-loop (new)
- [x] T17 routines/learning-loop/schema.json (proposals[] of add|task)
- [x] T18 routines/learning-loop/routine.yaml
- [x] T19 routines/learning-loop/prompt.md (classify; uncertain -> hypothesis/candidate)
- [x] T20 routines/learning-loop/fixtures/response.ok.json
- [x] T21 routines/learning-loop/fixtures/response.bad.json
- [x] T22 routines/learning-loop/memory.md
- [x] T23 routines/learning-loop/learning-loop.test.ts

## granola-capture (new)
- [x] T24 routines/granola-capture/schema.json (raw captured items + origin)
- [x] T25 routines/granola-capture/routine.yaml
- [x] T26 routines/granola-capture/prompt.md
- [x] T27 routines/granola-capture/fixtures/response.ok.json
- [x] T28 routines/granola-capture/fixtures/response.bad.json
- [x] T29 routines/granola-capture/memory.md
- [x] T30 routines/granola-capture/granola-capture.test.ts

## watchdog (new)
- [x] T31 routines/watchdog/schema.json (health report + reindex proposals)
- [x] T32 routines/watchdog/routine.yaml
- [x] T33 routines/watchdog/prompt.md
- [x] T34 routines/watchdog/fixtures/response.ok.json
- [x] T35 routines/watchdog/fixtures/response.bad.json
- [x] T36 routines/watchdog/memory.md
- [x] T37 routines/watchdog/watchdog.test.ts

## daily-command-center (modify)
- [x] T38 add state/ source; render promoted vs candidate
- [x] T39 update fixtures (ok/bad) + test for the state-aware brief

## weekly-review (repurpose into curator)
- [x] T40 schema.json — transition/correct proposals[]
- [x] T41 routine.yaml + prompt.md — curator role over full state/
- [x] T42 update fixtures (ok/bad) + test

## verify
- [x] T43 npm run typecheck + npm test green
- [x] T44 manual runs from spec Verification (run + apply --dry-run)
- [x] T45 confirm run path unchanged (contract/compose/validator/runner/preflight/guards)
