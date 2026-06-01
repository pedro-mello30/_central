import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Adapter } from "../adapters/base.js";
import { composePrompt } from "./compose.js";
import { loadRoutine } from "./contract.js";
import { appendMemory, formatRecentForPrompt, readRecentMemory } from "./memory.js";
import { preflight } from "./preflight.js";
import { extractJsonBlock, validateOutput } from "./validator.js";
import type { Failure, Inputs, LoadedRoutine, RunResult } from "./types.js";

/** Options for a single routine execution; all fields except `adapter` are optional overrides. */
export interface RunOptions {
  adapter: Adapter;
  inputs?: Inputs;
  /** Override clock for deterministic tests. */
  now?: () => Date;
  /** Skip appending to memory (used by some tests). */
  skipMemory?: boolean;
  /** How many recent memory records to feed back as prompt context. Default 5. */
  memoryContext?: number;
  /** Override run-id generation for deterministic tests. */
  mkRunId?: () => string;
}

/** Default run-id: sortable timestamp prefix + short random suffix. */
function defaultRunId(startedAt: string): string {
  const stamp = startedAt.replace(/[-:.TZ]/g, "").slice(0, 14);
  return `run_${stamp}_${randomBytes(3).toString("hex")}`;
}

/** Capture low-confidence items from output for the memory log (hypothesis != truth). */
function captureHypotheses(json: unknown): string[] {
  if (json === null || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const src = Array.isArray(obj.hypotheses)
    ? obj.hypotheses
    : Array.isArray(obj.problems)
      ? obj.problems
      : [];
  return src.filter((x): x is string => typeof x === "string");
}

/** Run a routine from a directory (already on disk) through an adapter. */
export async function runLoaded(loaded: LoadedRoutine, opts: RunOptions): Promise<RunResult> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const runId = opts.mkRunId?.() ?? defaultRunId(startedAt);
  const inputs = opts.inputs ?? {};
  const failures: Failure[] = [];

  // --- Memory read-back: feed recent runs in as read-only context. ---
  const recent = readRecentMemory(loaded, opts.memoryContext ?? 5);
  const composed = composePrompt(loaded, inputs, {
    recentMemory: formatRecentForPrompt(recent),
  });

  // --- Preflight: catch failures before the model. ---
  // Routine-level checks, then adapter-level reachability (e.g. CLI on PATH).
  const pre = [...preflight(loaded, inputs, composed), ...(opts.adapter.preflight?.() ?? [])];
  failures.push(...pre);

  let raw: string | undefined;
  let json: unknown;

  if (pre.length === 0) {
    // --- Invoke the model via the adapter. ---
    const result = await opts.adapter.run(composed, { loaded });
    raw = result.raw;
    if (result.exitStatus !== 0) {
      failures.push({
        stage: "adapter",
        message: `adapter "${opts.adapter.name}" exited ${result.exitStatus}`,
      });
    }

    // --- Validate output against schema, if declared. ---
    if (loaded.routine.outputs.schema) {
      const parsed = extractJsonBlock(raw);
      if (parsed === undefined) {
        failures.push({
          stage: "validate",
          message: "no parseable ```json block found in adapter output",
        });
      } else {
        const schemaPath = join(loaded.dir, loaded.routine.outputs.schema);
        const v = validateOutput(parsed, schemaPath);
        if (v.valid) json = parsed;
        else failures.push(...v.failures);
      }
    } else {
      json = extractJsonBlock(raw);
    }
  }

  const status: RunResult["status"] = failures.length === 0 ? "ok" : "failed";
  const markdown = renderMarkdown(loaded, { status, raw, failures });
  const hypotheses = captureHypotheses(json);
  const finishedAt = now().toISOString();
  const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);

  const result: RunResult = {
    runId,
    routine: loaded.routine.name,
    model: opts.adapter.name,
    status,
    markdown,
    json,
    failures,
    hypotheses,
    raw,
    startedAt,
    finishedAt,
    durationMs,
  };

  if (!opts.skipMemory) {
    appendMemory(loaded, {
      timestamp: startedAt,
      model: opts.adapter.name,
      status,
      hypotheses,
      notes: failures.length ? `${failures.length} failure(s)` : undefined,
    });
  }

  return result;
}

/** Convenience: load by directory then run. */
export async function run(routineDir: string, opts: RunOptions): Promise<RunResult> {
  return runLoaded(loadRoutine(routineDir), opts);
}

function renderMarkdown(
  loaded: LoadedRoutine,
  data: { status: RunResult["status"]; raw?: string; failures: Failure[] },
): string {
  const out: string[] = [];
  out.push(`# ${loaded.routine.name} — ${data.status.toUpperCase()}`);
  out.push(loaded.routine.goal);
  if (data.raw) out.push(`## Output\n${data.raw.trim()}`);
  if (data.failures.length > 0) {
    const lines = data.failures.map((f) => `- [${f.stage}] ${f.message}`).join("\n");
    out.push(`## ⚠️ Failures\n${lines}`);
  }
  return out.join("\n\n") + "\n";
}
