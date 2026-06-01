# Contributing

Thanks for your interest in `_central`. This is a model-agnostic routine engine:
>90% of behavior lives in portable routine artifacts, <10% in model-specific
adapters. Keep that ratio in mind when deciding where code belongs.

## Development setup

```bash
npm ci          # install locked dependencies
npm run typecheck
npm run lint
npm test
```

All four must pass before a change is merged — CI enforces them on every PR.

## Spec-driven development

Non-trivial changes start as a spec, not code. See `specs/NNNN-*/` for the
format: each increment has `spec.md` (source of truth), `plan.md`, and
`tasks.md`. Add the next numbered folder before implementing.

## Conventions

- **Tests are co-located** with the code they cover (`foo.ts` + `foo.test.ts`)
  and run on Vitest. New modules and routines ship with tests.
- **Inject side effects.** External processes and filesystem access go through
  injectable seams (e.g. `CommandRunner`, `WhichFn`) so units stay testable
  without real subprocesses.
- **Respect the guardrails.** Don't add autonomous writes or auto-promotion of
  hypotheses. See [SECURITY.md](./SECURITY.md) for the trust model.
- **TypeScript is strict** (`strict` + `noUncheckedIndexedAccess`). Keep the
  typecheck clean.

## Adding a routine

Create `routines/<name>/` with `routine.yaml`, `prompt.md`, `schema.json`,
`fixtures/`, and a `<name>.test.ts` that exercises the routine against the mock
adapter. Validate with:

```bash
npx tsx run.ts run <name> --model mock
```

## Pull requests

Keep PRs focused, describe the change, and make sure CI is green. By
contributing you agree your work is licensed under the project's
[MIT License](./LICENSE).
