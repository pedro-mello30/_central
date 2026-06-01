import type { Failure, LoadedRoutine } from "../core/types.js";

export interface AdapterRunResult {
  raw: string;
  exitStatus: number;
}

export interface AdapterOpts {
  /** The loaded routine, so adapters can map tools/guards to their own surface. */
  loaded: LoadedRoutine;
}

/**
 * The entire model-specific surface. Keep <10% of logic here: an adapter only maps
 * the composed prompt onto a runtime (Claude Code, Codex, or a mock) and returns text.
 */
export interface Adapter {
  readonly name: string;
  /**
   * Optional environment/reachability checks performed BEFORE run(). Returning any
   * failures causes the runner to skip run() and surface them as visible output.
   */
  preflight?(): Failure[];
  run(composedPrompt: string, opts: AdapterOpts): Promise<AdapterRunResult>;
}
