# Spec 0001 — Agnostic Engine Core

Status: accepted (implemented + verified 2026-06-01)
Increment: 0001
Depends on: none

## Goal

Build the model-agnostic core of `_central`: load a vendor-neutral routine folder,
validate its contract, compose a prompt, run it through a pluggable adapter, validate
the output, and emit a result plus a memory entry. This increment is fully offline —
it ships a `mock` adapter so the entire engine is provable without any real model CLI
or network access.

## Background

See `docs/plans/2026-06-01-central-design.md`. Principle: <10% of logic in adapters,
>90% in shared artifacts. Routines follow the briefing contract
`Trigger → Sources → Criteria → Output → Guardrails → Learning`.

## Scope (in)

- `core/types.ts` — TypeScript types for the routine contract and run result.
- `core/contract.ts` — zod schema for `routine.yaml` + `loadRoutine(dir)` parsing.
- `core/compose.ts` — deterministic prompt composition from routine + resolved inputs.
- `core/preflight.ts` — cheap pre-model checks; returns failures, never throws past them.
- `core/validator.ts` — validate a routine's output JSON against its `schema.json` (ajv).
- `adapters/base.ts` — `Adapter` interface + `RunResult` type.
- `adapters/mock.ts` — deterministic adapter that echoes a fixture-defined response.
- `core/runner.ts` — orchestrates the full flow; enforces guards structurally.
- `core/memory.ts` — append a structured entry to the routine's `memory.md`.
- `run.ts` — minimal CLI: `run.ts <routine> --model mock`.
- An example routine `routines/example-echo/` with fixtures.
- Vitest tests covering loader, compose, preflight, validator, runner, memory.

## Scope (out)

- Real `claude` / `codex` adapters (→ 0002).
- Scheduling / cron / triggers execution (→ 0004).
- Memory read-back as context (→ 0004).

## The routine contract (validated shape)

```yaml
name: string                 # required, kebab-case
version: number              # required
goal: string                 # required
trigger:
  type: schedule|api|github|manual
  cron?: string
sources:
  - id: string
    trust: source|context|hypothesis
inputs: string[]             # names resolved at runtime
tools:
  shell?: boolean
  web?: boolean
  mcp?: string[]
criteria?: string
outputs:
  format: string             # e.g. "markdown+json"
  schema?: string            # filename relative to routine dir
guards:
  write_allowed: boolean
  forbidden_paths?: string[]
  max_files_changed?: number
learning?:
  memory?: string            # filename, default "memory.md"
  promote?: human|auto
```

## Behavior

1. **load** — read `routine.yaml`, parse YAML, validate against zod. Invalid ⇒ typed error.
2. **resolve** — fill declared `inputs` from a provided context object (CLI passes
   `date`, `timezone` by default). Missing required input ⇒ preflight failure.
3. **compose** — build a single prompt string: header (goal) + criteria + sources list
   + resolved inputs + output contract instructions. Deterministic given same inputs.
4. **preflight** — checks, collected (not throwing):
   - all declared `inputs` resolved
   - guard coherence: `write_allowed === false` ⇒ `max_files_changed` is 0 or unset
   - composed prompt non-empty
   - if `outputs.schema` set, the schema file exists and parses
   On any failure ⇒ skip adapter, emit a result with a `## ⚠️ Failures` section.
5. **adapter.run** — pass composed prompt; mock returns the fixture response + exit 0.
6. **validate** — if `outputs.schema` set, extract the JSON block from adapter output and
   validate with ajv. Invalid ⇒ failure recorded, result still emitted (visible).
7. **emit** — return a `RunResult` (and the CLI prints markdown + writes JSON).
8. **learn** — append a structured entry to the routine's memory file.

## Guard enforcement (structural)

The runner NEVER applies file writes or external mutations. Even with a populated
adapter response, only *proposed* actions are reported. `write_allowed: false` is the
default posture for 0001 — there is no write path in this increment at all.

## Acceptance criteria

- [ ] `routines/example-echo/` loads and validates against the zod contract.
- [ ] A malformed `routine.yaml` (e.g. missing `goal`) produces a typed validation error.
- [ ] `compose()` is deterministic: same routine+inputs → identical prompt string.
- [ ] preflight catches a missing input and incoherent guards, returning failures (no throw).
- [ ] output validation rejects a fixture whose JSON violates `schema.json`.
- [ ] `runner.run(routine, {model: 'mock'})` produces a `RunResult` with status `ok`
      for a valid fixture, and appends one entry to `memory.md`.
- [ ] A preflight/validation failure yields a result containing a `## ⚠️ Failures` section.
- [ ] `npm test` passes; `npm run typecheck` passes.
- [ ] `npx tsx run.ts example-echo --model mock` prints a brief and exits 0.

## Verification

```
npm run typecheck
npm test
npx tsx run.ts example-echo --model mock
```
