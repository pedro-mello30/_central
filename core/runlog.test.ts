import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRunLog, formatRunLogLine, runLogPath, toRunRecord } from "./runlog.js";
import type { RunResult } from "./types.js";

const tmpDirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "central-runlog-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const RESULT: RunResult = {
  runId: "run_20260601084000_abc",
  routine: "daily-command-center",
  model: "claude",
  status: "failed",
  markdown: "# ...",
  json: { ok: true },
  failures: [{ stage: "validate", message: "no json block" }],
  hypotheses: ["maybe stale", "unsure about X"],
  raw: "...",
  startedAt: "2026-06-01T08:40:00.000Z",
  finishedAt: "2026-06-01T08:40:02.500Z",
  durationMs: 2500,
};

describe("toRunRecord", () => {
  it("projects a result into a compact, machine-readable record without bulky fields", () => {
    const rec = toRunRecord(RESULT);
    expect(rec).toEqual({
      runId: "run_20260601084000_abc",
      routine: "daily-command-center",
      model: "claude",
      status: "failed",
      startedAt: "2026-06-01T08:40:00.000Z",
      finishedAt: "2026-06-01T08:40:02.500Z",
      durationMs: 2500,
      failureCount: 1,
      hypothesisCount: 2,
      failures: [{ stage: "validate", message: "no json block" }],
    });
    // Heavy fields are deliberately excluded from the durable log.
    expect("raw" in rec).toBe(false);
    expect("markdown" in rec).toBe(false);
    expect("json" in rec).toBe(false);
  });
});

describe("formatRunLogLine", () => {
  it("renders a single structured summary line", () => {
    const line = formatRunLogLine(toRunRecord(RESULT));
    expect(line).toBe(
      "run_20260601084000_abc daily-command-center model=claude status=failed duration=2500ms failures=1 hypotheses=2",
    );
  });
});

describe("appendRunLog", () => {
  it("appends one JSON line per run to runs/runs.jsonl, creating the dir", () => {
    const repo = tmp();
    const first = appendRunLog(repo, toRunRecord(RESULT));
    appendRunLog(repo, toRunRecord({ ...RESULT, runId: "run_2", status: "ok" }));

    expect(first).toBe(runLogPath(repo));
    const lines = readFileSync(runLogPath(repo), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).runId).toBe("run_20260601084000_abc");
    expect(JSON.parse(lines[1]!)).toMatchObject({ runId: "run_2", status: "ok" });
  });
});
