import type { RunRecord } from "./runlog.js";

/**
 * An operator-facing rollup of every run for one routine, derived purely from
 * the durable run log. Durations are milliseconds; `okRate` is a 0..1 fraction.
 */
export interface RoutineMetrics {
  routine: string;
  runs: number;
  okRate: number;
  p50Ms: number;
  p95Ms: number;
  failures: number;
}

/**
 * Parse the append-only run log (JSONL) into records. Deliberately tolerant:
 * blank lines and malformed JSON are skipped rather than thrown, so a single
 * corrupt line can never blind the whole report.
 */
export function parseRunLog(text: string): RunRecord[] {
  const out: RunRecord[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as RunRecord);
    } catch {
      // skip unparseable line
    }
  }
  return out;
}

/** Nearest-rank percentile (p in 0..1) over an already-sorted ascending array. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil(p * sortedAsc.length);
  const idx = Math.min(Math.max(rank, 1), sortedAsc.length) - 1;
  return sortedAsc[idx]!;
}

/**
 * Roll records up per routine, sorted by routine name for stable output.
 * `failures` sums each run's failure count; `okRate` is ok runs / total runs.
 */
export function aggregate(records: RunRecord[]): RoutineMetrics[] {
  const byRoutine = new Map<string, RunRecord[]>();
  for (const r of records) {
    const list = byRoutine.get(r.routine) ?? [];
    list.push(r);
    byRoutine.set(r.routine, list);
  }

  const metrics: RoutineMetrics[] = [];
  for (const [routine, list] of byRoutine) {
    const durations = list.map((r) => r.durationMs).sort((a, b) => a - b);
    const okCount = list.filter((r) => r.status === "ok").length;
    metrics.push({
      routine,
      runs: list.length,
      okRate: okCount / list.length,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      failures: list.reduce((sum, r) => sum + r.failureCount, 0),
    });
  }
  return metrics.sort((a, b) => a.routine.localeCompare(b.routine));
}

/** Render a duration in ms as a compact human string (e.g. `47ms`, `1.2s`). */
function humanMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const COLS = ["routine", "runs", "ok%", "p50", "p95", "fails"] as const;

/** Render rollups as an aligned text table, or an empty-state line. */
export function formatMetricsTable(metrics: RoutineMetrics[]): string {
  if (metrics.length === 0) return "no runs recorded yet — run a routine first.";

  const rows = metrics.map((m) => [
    m.routine,
    String(m.runs),
    `${Math.round(m.okRate * 100)}%`,
    humanMs(m.p50Ms),
    humanMs(m.p95Ms),
    String(m.failures),
  ]);

  const widths = COLS.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i]!.length)));
  const pad = (cells: readonly string[]) =>
    cells
      .map((c, i) => c.padEnd(widths[i]!))
      .join("  ")
      .trimEnd();

  return [pad(COLS), ...rows.map(pad)].join("\n");
}
