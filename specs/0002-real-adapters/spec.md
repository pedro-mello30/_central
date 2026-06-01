# Spec 0002 — Real Adapters (Claude Code + Codex)

Status: accepted (implemented + verified 2026-06-01)
Increment: 0002
Depends on: 0001

## Goal

Add the two real model adapters so the same routine runs unchanged on either runtime —
the proof of agnosticism. `adapters/claude.ts` invokes the `claude` CLI in headless
print mode; `adapters/codex.ts` invokes `codex exec`. Both implement the existing
`Adapter` interface from 0001, keeping <10% of logic vendor-specific. Add adapter-level
**preflight reachability** so a missing CLI fails visibly before any run, and wire both
into the `run.ts --model` selector.

## Background

See `docs/plans/2026-06-01-central-design.md` and spec 0001. The engine, contract,
compose, validator, runner, and memory are done and offline-tested via the mock adapter.
This increment only touches the adapter layer + CLI selection + a small runner hook.

## Scope (in)

- `core/exec.ts` — a thin, injectable command runner (`CommandRunner`) over
  `child_process.spawn`, plus a `which(bin)` PATH check. Injectable so adapters are
  unit-testable without the real CLIs installed.
- Extend `adapters/base.ts` — add an optional `preflight(): Failure[]` to `Adapter`
  (reachability / environment checks performed before `run`).
- `adapters/claude.ts` — `ClaudeAdapter`: pipes the composed prompt to `claude` stdin
  in print mode, captures stdout, maps exit code. Preflight checks the `claude` binary
  is on PATH.
- `adapters/codex.ts` — `CodexAdapter`: pipes the composed prompt to `codex exec` stdin,
  captures stdout, maps exit code. Preflight checks the `codex` binary is on PATH.
- `core/runner.ts` — call `adapter.preflight?.()` and merge results into the existing
  preflight stage, so an unreachable CLI blocks the run (adapter never spawned) and
  surfaces in the `## ⚠️ Failures` section.
- `run.ts` — `selectAdapter` gains `claude` and `codex` cases.
- Tests for both adapters (injected fake runner + fake PATH check) and a runner test
  proving a missing binary blocks execution.

## Scope (out)

- Scheduling / triggers execution (→ 0004).
- Mapping `tools.mcp` / connectors into runtime config — runtime detail, not contract
  semantics; deferred until a routine needs it.
- Authentication setup for the CLIs (assumed already configured on the host).

## CLI invocation contract

Both CLIs accept the prompt on **stdin** and print the result to **stdout**:

| Adapter | Command | Prompt | Output |
| --- | --- | --- | --- |
| claude | `claude -p` (print mode) | piped to stdin | stdout |
| codex  | `codex exec` | piped to stdin | stdout |

`AdapterRunResult` = `{ raw: stdout, exitStatus }`. Non-zero exit → recorded as an
`adapter` failure by the runner (already implemented in 0001). stderr is appended to
`raw` only when the exit status is non-zero, to aid debugging without polluting output.

## Guardrail posture

The engine already enforces write-narrow structurally (it never applies writes). Adapters
do not grant extra capabilities in this increment; they run the CLI with its default
permissions and only read back text. No adapter writes to the routine or repo.

## Acceptance criteria

- [ ] `core/exec.ts` exposes `CommandRunner`, a default spawn-based runner, and `which`.
- [ ] `ClaudeAdapter.run` invokes `claude -p` with the prompt on stdin and returns
      `{ raw, exitStatus }` (verified with an injected fake runner).
- [ ] `CodexAdapter.run` invokes `codex exec` with the prompt on stdin and returns
      `{ raw, exitStatus }` (verified with an injected fake runner).
- [ ] Each adapter's `preflight()` returns a failure when its binary is absent from PATH
      and none when present (injected `which`).
- [ ] The runner merges adapter preflight failures and does NOT spawn the adapter when
      preflight fails.
- [ ] `run.ts --model claude` and `--model codex` resolve to the right adapter.
- [ ] Existing 0001 tests still pass; `npm run typecheck` and `npm test` pass.

## Verification

```
npm run typecheck
npm test
# with CLIs installed + authed on the host:
npx tsx run.ts example-echo --model claude --input name=Pedro
npx tsx run.ts example-echo --model codex  --input name=Pedro
```
