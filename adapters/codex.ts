import { defaultRunner, which, type CommandRunner, type WhichFn } from "../core/exec.js";
import type { Failure } from "../core/types.js";
import type { Adapter, AdapterOpts, AdapterRunResult } from "./base.js";

export interface CodexAdapterDeps {
  runner?: CommandRunner;
  which?: WhichFn;
  command?: string;
}

/**
 * Runs a routine via the Codex CLI (`codex exec`). The composed prompt is piped to
 * stdin; the result is read from stdout. Vendor-specific surface only.
 */
export class CodexAdapter implements Adapter {
  readonly name = "codex";
  readonly command: string;
  readonly args = ["exec"];
  private readonly runner: CommandRunner;
  private readonly which: WhichFn;

  constructor(deps: CodexAdapterDeps = {}) {
    this.command = deps.command ?? "codex";
    this.runner = deps.runner ?? defaultRunner;
    this.which = deps.which ?? which;
  }

  preflight(): Failure[] {
    if (!this.which(this.command)) {
      return [
        {
          stage: "preflight",
          message: `codex CLI "${this.command}" not found on PATH (install Codex or set --command)`,
        },
      ];
    }
    return [];
  }

  async run(composedPrompt: string, _opts: AdapterOpts): Promise<AdapterRunResult> {
    const r = await this.runner(this.command, this.args, composedPrompt);
    const raw = r.exitStatus === 0 ? r.stdout : `${r.stdout}\n${r.stderr}`.trim();
    return { raw, exitStatus: r.exitStatus };
  }
}
