# Tasks 0002 — Real Adapters

- [x] T1  core/exec.ts — CommandResult, CommandRunner, defaultRunner, which
- [x] T2  adapters/base.ts — add optional preflight() to Adapter
- [x] T3  adapters/claude.ts — ClaudeAdapter (stdin prompt, claude -p)
- [x] T4  adapters/claude.test.ts — invocation mapping + preflight reachability
- [x] T5  adapters/codex.ts — CodexAdapter (stdin prompt, codex exec)
- [x] T6  adapters/codex.test.ts — invocation mapping + preflight reachability
- [x] T7  core/runner.ts — merge adapter.preflight(), skip spawn on failure
- [x] T8  core/runner.test.ts — missing-binary blocks run
- [x] T9  run.ts — selectAdapter adds claude + codex
- [x] T10 verify: typecheck + test
