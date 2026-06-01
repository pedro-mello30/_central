import { defaultRunner, which, type CommandRunner, type WhichFn } from "../core/exec.js";
import type { Failure } from "../core/types.js";
import type { Adapter, AdapterOpts, AdapterRunResult } from "./base.js";

export interface ClaudeAdapterDeps {
  runner?: CommandRunner;
  which?: WhichFn;
  command?: string;
}

/**
 * Runs a routine via the Claude Code CLI in headless print mode.
 * The composed prompt is piped to stdin; the result is read from stdout.
 * Vendor-specific surface only — no routine logic lives here.
 */
export class ClaudeAdapter implements Adapter {
  readonly name = "claude";
  readonly command: string;
  readonly args = ["-p"];
  private readonly runner: CommandRunner;
  private readonly which: WhichFn;

  constructor(deps: ClaudeAdapterDeps = {}) {
    this.command = deps.command ?? "claude";
    this.runner = deps.runner ?? defaultRunner;
    this.which = deps.which ?? which;
  }

  preflight(): Failure[] {
    if (!this.which(this.command)) {
      return [
        {
          stage: "preflight",
          message: `claude CLI "${this.command}" not found on PATH (install Claude Code or set --command)`,
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
