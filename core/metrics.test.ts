import { describe, expect, it } from "vitest";
import { aggregate, formatMetricsTable, parseRunLog } from "./metrics.js";
import type { RunRecord } from "./runlog.js";

function rec(over: Partial<RunRecord>): RunRecord {
  return {
    runId: "run_x",
    routine: "r",
    model: "mock",
    status: "ok",
    startedAt: "2026-06-01T00:00:00.000Z",
    finishedAt: "2026-06-01T00:00:00.001Z",
    durationMs: 1,
    failureCount: 0,
    hypothesisCount: 0,
    failures: [],
    ...over,
  };
}

describe("parseRunLog", () => {
  it("parses one record per non-empty line", () => {
    const text =
      JSON.stringify(rec({ runId: "a" })) + "\n" + JSON.stringify(rec({ runId: "b" })) + "\n";
    const recs = parseRunLog(text);
    expect(recs.map((r) => r.runId)).toEqual(["a", "b"]);
  });

  it("tolerates blank lines and malformed JSON without throwing", () => {
    const good = JSON.stringify(rec({ runId: "good" }));
    const text = `\n${good}\n{not json\n   \n`;
    const recs = parseRunLog(text);
    expect(recs.map((r) => r.runId)).toEqual(["good"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseRunLog("")).toEqual([]);
  });
});

describe("aggregate", () => {
  it("groups by routine and sorts routines by name", () => {
    const m = aggregate([rec({ routine: "zebra" }), rec({ routine: "alpha" })]);
    expect(m.map((x) => x.routine)).toEqual(["alpha", "zebra"]);
  });

  it("computes run count, ok rate, and summed failures", () => {
    const m = aggregate([
      rec({ routine: "r", status: "ok", failureCount: 0 }),
      rec({ routine: "r", status: "failed", failureCount: 2 }),
      rec({ routine: "r", status: "ok", failureCount: 0 }),
      rec({ routine: "r", status: "failed", failureCount: 1 }),
    ]);
    expect(m[0]).toMatchObject({ routine: "r", runs: 4, okRate: 0.5, failures: 3 });
  });

  it("computes p50 and p95 by nearest-rank over durations", () => {
    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const m = aggregate(durations.map((d) => rec({ routine: "r", durationMs: d })));
    // nearest-rank: p50 -> ceil(0.5*10)=5th = 50; p95 -> ceil(0.95*10)=10th = 100
    expect(m[0]).toMatchObject({ p50Ms: 50, p95Ms: 100 });
  });

  it("handles a single record (p50 == p95 == its duration)", () => {
    const m = aggregate([rec({ routine: "r", durationMs: 42 })]);
    expect(m[0]).toMatchObject({ runs: 1, p50Ms: 42, p95Ms: 42 });
  });

  it("returns an empty array for no records", () => {
    expect(aggregate([])).toEqual([]);
  });
});

describe("formatMetricsTable", () => {
  it("renders a header and one row per routine with a percentage and seconds", () => {
    const table = formatMetricsTable(
      aggregate([
        rec({ routine: "daily", status: "ok", durationMs: 1200 }),
        rec({ routine: "daily", status: "failed", durationMs: 3100, failureCount: 1 }),
      ]),
    );
    expect(table).toContain("routine");
    expect(table).toContain("daily");
    expect(table).toContain("50%");
    expect(table).toContain("1.2s");
  });

  it("reports an empty state when there are no metrics", () => {
    expect(formatMetricsTable([])).toMatch(/no runs/i);
  });
});
