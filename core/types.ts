// Core types for the model-agnostic routine engine.

export type TrustLevel = "source" | "context" | "hypothesis";
export type TriggerType = "schedule" | "api" | "github" | "manual";
export type PromoteMode = "human" | "auto";

export interface RoutineSource {
  id: string;
  trust: TrustLevel;
}

export interface RoutineTrigger {
  type: TriggerType;
  cron?: string;
}

export interface RoutineTools {
  shell?: boolean;
  web?: boolean;
  mcp?: string[];
}

export interface RoutineOutputs {
  format: string;
  schema?: string;
}

export interface RoutineGuards {
  write_allowed: boolean;
  forbidden_paths?: string[];
  max_files_changed?: number;
}

export interface RoutineLearning {
  memory?: string;
  promote?: PromoteMode;
}

export interface Routine {
  name: string;
  version: number;
  goal: string;
  trigger: RoutineTrigger;
  sources: RoutineSource[];
  inputs: string[];
  tools: RoutineTools;
  criteria?: string;
  outputs: RoutineOutputs;
  guards: RoutineGuards;
  learning?: RoutineLearning;
}

/** A loaded routine plus the directory it came from. */
export interface LoadedRoutine {
  routine: Routine;
  dir: string;
}

/** Resolved input values, keyed by the names declared in routine.inputs. */
export type Inputs = Record<string, string>;

/** A single recorded problem; failures are first-class, visible output. */
export interface Failure {
  stage: "preflight" | "adapter" | "validate";
  message: string;
}

/** What every adapter returns. */
export interface RunResult {
  /** Stable, unique identity for this run — the key for observability/correlation. */
  runId: string;
  routine: string;
  model: string;
  status: "ok" | "failed";
  /** Markdown rendered for humans. */
  markdown: string;
  /** Parsed + validated JSON output, when a schema was provided and it passed. */
  json?: unknown;
  failures: Failure[];
  /** Low-confidence items captured from the output (hypothesis != truth). */
  hypotheses: string[];
  /** The raw adapter output (model text), when the adapter ran. */
  raw?: string;
  /** ISO timestamp when the run started. */
  startedAt: string;
  /** ISO timestamp when the run finished. */
  finishedAt: string;
  /** Wall-clock duration of the run, in milliseconds. */
  durationMs: number;
}
