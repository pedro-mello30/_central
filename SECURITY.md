# Security Policy

## Reporting a vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/pedro-mello30/_central/security/advisories/new)
rather than opening a public issue. You can expect an initial response within a
few days.

## Security model

`_central` is a model-agnostic routine engine. Its trust boundary is built on a
few deliberate guarantees — when reviewing or extending the code, preserve them:

- **No autonomous writes.** Routines declare `write_allowed: false`. The engine
  never auto-writes, publishes, or mutates external state. Persisting anything
  (e.g. `apply`) is an explicit, separate, human-invoked step and supports
  `--dry-run`.
- **Human-in-the-loop promotion.** A run's low-confidence items are recorded as
  `hypotheses` and stay *candidates* until a human `promote`s them. A hypothesis
  is never treated as truth.
- **No shell string interpolation.** External CLIs (`claude`, `codex`) are
  invoked via `spawn(cmd, args[])` with argument arrays — never a shell string —
  so routine/model output cannot inject commands.
- **Failures are surfaced, never hidden.** Errors are reported in a visible
  `## ⚠️ Failures` section instead of being swallowed.
- **No secrets in-repo.** Credentials live with the external CLIs the adapters
  shell out to; the engine itself stores none. Run artifacts (`runs/`,
  `.last-run.json`, `*.log`) are git-ignored.

## Supported versions

This project is pre-1.0; only the latest `main` is supported.
