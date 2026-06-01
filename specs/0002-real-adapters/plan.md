# Plan 0002 — Real Adapters

TDD with dependency injection: adapters take a `CommandRunner` and a `which` checker so
they are fully unit-testable without the real `claude` / `codex` binaries.

## Order of work

1. **exec helper** — `core/exec.ts`: `CommandResult`, `CommandRunner` type, default
   spawn-based runner, `which(bin)`.
2. **interface** — extend `adapters/base.ts` with optional `preflight(): Failure[]`.
3. **claude adapter** — `adapters/claude.ts`. Test with fake runner + fake which.
4. **codex adapter** — `adapters/codex.ts`. Test with fake runner + fake which.
5. **runner hook** — merge `adapter.preflight?.()` into the preflight stage; skip spawn
   on failure. Test: missing binary blocks run.
6. **CLI** — `run.ts selectAdapter` adds claude/codex.
7. **verify** — typecheck + full suite.

## Design notes

- Default runner: `spawn(cmd, args)`, write `input` to stdin, collect stdout/stderr,
  resolve on close with the exit code. Never throws on non-zero exit (that's data).
- `which`: use `process.env.PATH` split + `fs.existsSync`, or `spawnSync('which'/'where')`.
  Keep it dependency-free and cross-checkable in tests via injection.
- Adapters expose their command/args as readonly fields so tests can assert the mapping
  without spawning.

## Files

- core/exec.ts
- adapters/base.ts (edit), adapters/claude.ts, adapters/codex.ts
- core/runner.ts (edit)
- run.ts (edit)
- adapters/claude.test.ts, adapters/codex.test.ts, core/runner.test.ts (extend)
