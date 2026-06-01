# Plan 0001 — Agnostic Engine Core

TDD: write the test, watch it fail, implement, watch it pass. Build bottom-up so each
layer is verified before the layer that depends on it.

## Order of work

1. **Types + contract (zod)** — `core/types.ts`, `core/contract.ts`.
   Test: valid fixture parses; missing `goal` throws typed error.
2. **Example routine** — `routines/example-echo/` (`routine.yaml`, `prompt.md`,
   `schema.json`, `fixtures/response.ok.json`, `fixtures/response.bad.json`).
3. **Compose** — `core/compose.ts`. Test: determinism + contains goal/criteria/inputs.
4. **Preflight** — `core/preflight.ts`. Test: missing input, incoherent guards.
5. **Validator** — `core/validator.ts` (ajv). Test: ok fixture passes, bad fails.
6. **Adapter interface + mock** — `adapters/base.ts`, `adapters/mock.ts`.
7. **Memory** — `core/memory.ts`. Test: appends a parseable entry.
8. **Runner** — `core/runner.ts`. Test: end-to-end ok path + failure path.
9. **CLI** — `run.ts`. Manual verification command.

## Files

- core/types.ts, core/contract.ts, core/compose.ts, core/preflight.ts,
  core/validator.ts, core/memory.ts, core/runner.ts
- adapters/base.ts, adapters/mock.ts
- run.ts
- routines/example-echo/{routine.yaml,prompt.md,schema.json,fixtures/*}
- core/*.test.ts

## Risks

- ESM + tsx path resolution → use explicit relative imports with extensions where needed.
- JSON extraction from model output → define a clear convention (fenced ```json block).
