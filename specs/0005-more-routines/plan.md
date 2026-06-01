# Plan 0005 — More Routines

Pure authoring on the existing engine. Mirror the daily-command-center pattern (0003).

## Order of work

1. **weekly-review** — schema → routine.yaml → prompt.md → fixtures (ok/bad) → memory → test.
2. **linkedin-radar** — schema → routine.yaml → prompt.md → fixtures (ok/bad) → memory → test.
3. **verify** — typecheck + test + manual runs + schedule lines.
4. **prove reuse** — confirm no source files under core/ or adapters/ changed.

## Notes

- `bad` fixtures must fail on a *schema* rule (array bounds), so validation is what
  catches them — same discipline as 0003.
- Keep fixture markdown realistic so the rendered brief reads like the real thing.
- tsconfig already globs `routines/**/*.test.ts`; no config change needed.
