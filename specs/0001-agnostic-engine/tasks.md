# Tasks 0001 — Agnostic Engine Core

- [x] T1  core/types.ts — contract + RunResult types
- [x] T2  core/contract.ts — zod schema + loadRoutine(dir)
- [x] T3  core/contract.test.ts — valid + invalid routine
- [x] T4  routines/example-echo/* — routine.yaml, prompt.md, schema.json, fixtures
- [x] T5  core/compose.ts — composePrompt(routine, inputs)
- [x] T6  core/compose.test.ts — determinism + content
- [x] T7  core/preflight.ts — preflight(routine, inputs, dir) -> Failure[]
- [x] T8  core/preflight.test.ts — missing input, incoherent guards
- [x] T9  core/validator.ts — validateOutput(json, schemaPath)
- [x] T10 core/validator.test.ts — ok + bad fixtures
- [x] T11 adapters/base.ts — Adapter interface, RunResult
- [x] T12 adapters/mock.ts — fixture-driven deterministic adapter
- [x] T13 core/memory.ts — appendMemory(dir, entry)
- [x] T14 core/memory.test.ts — appends entry
- [x] T15 core/runner.ts — run(routineName, opts)
- [x] T16 core/runner.test.ts — ok path + failure path
- [x] T17 run.ts — CLI entry
- [x] T18 verify: typecheck + test + manual run
