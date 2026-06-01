import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Failure, RunResult } from "./types.js";

/**
 * A compact, machine-readable projection of a run — the unit of observability.
 * Deliberately excludes bulky fields (`raw`, `markdown`, `json`) so the durable
 * log stays small, greppable, and safe to retain.
 */
export interface RunRecord {
  runId: string;
  routine: string;
  model: string;
  status: RunResult["status"];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  failureCount: number;
  hypothesisCount: number;
  failures: Failure[];
}

/** Pure projection from a full run result to its durable record. */
export function toRunRecord(result: RunResult): RunRecord {
  return {
    runId: result.runId,
    routine: result.routine,
    model: result.model,
    status: result.status,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    failureCount: result.failures.length,
    hypothesisCount: result.hypotheses.length,
    failures: result.failures,
  };
}

/** A single structured summary line, suitable for stderr or a log scraper. */
export function formatRunLogLine(rec: RunRecord): string {
  return (
    `${rec.runId} ${rec.routine} model=${rec.model} status=${rec.status} ` +
    `duration=${rec.durationMs}ms failures=${rec.failureCount} hypotheses=${rec.hypothesisCount}`
  );
}

/** Path to the append-only run log (JSONL) under a repo's git-ignored `runs/`. */
export function runLogPath(repoDir: string): string {
  return join(repoDir, "runs", "runs.jsonl");
}

/**
 * Append one record as a JSON line to the run log, creating `runs/` if needed.
 * Append-only and one-record-per-line so the stream is durable and tail-able.
 * Returns the path written to.
 */
export function appendRunLog(repoDir: string, rec: RunRecord): string {
  const path = runLogPath(repoDir);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(rec) + "\n");
  return path;
}
