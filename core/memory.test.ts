import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRoutine } from "./contract.js";
import { appendMemory, parseMemory, promoteHypothesis, readRecentMemory } from "./memory.js";
import type { LoadedRoutine } from "./types.js";

const SRC = join(__dirname, "..", "routines", "example-echo");
const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe("memory", () => {
  it("appends a parseable entry with empty promoted list", () => {
    const dir = mkdtempSync(join(tmpdir(), "central-mem-"));
    tmpDirs.push(dir);
    cpSync(SRC, dir, { recursive: true });
    const loaded = loadRoutine(dir);

    const path = appendMemory(loaded, {
      timestamp: "2026-06-01T08:40:00Z",
      model: "mock",
      status: "ok",
      hypotheses: ["Lead X looks stale — verify?"],
      notes: "calendar quiet",
    });

    const text = readFileSync(path, "utf8");
    expect(text).toContain("## 2026-06-01T08:40:00Z — example-echo (mock)");
    expect(text).toContain("- status: ok");
    expect(text).toContain("Lead X looks stale");
    expect(text).toContain("- promoted: []");
  });
});

function freshRoutine(): LoadedRoutine {
  const dir = mkdtempSync(join(tmpdir(), "central-mem-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

describe("memory parse + readback", () => {
  it("round-trips entries written by appendMemory", () => {
    const loaded = freshRoutine();
    appendMemory(loaded, {
      timestamp: "2026-06-01T08:40:00Z",
      model: "mock",
      status: "ok",
      hypotheses: ["Lead X stale?"],
      notes: "quiet",
    });
    const records = parseMemory(readFileSync(join(loaded.dir, "memory.md"), "utf8"));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      timestamp: "2026-06-01T08:40:00Z",
      model: "mock",
      status: "ok",
      hypotheses: ["Lead X stale?"],
      promoted: [],
      notes: "quiet",
    });
  });

  it("returns the most recent n records, newest first", () => {
    const loaded = freshRoutine();
    for (const t of ["A", "B", "C"]) {
      appendMemory(loaded, { timestamp: t, model: "mock", status: "ok" });
    }
    const recent = readRecentMemory(loaded, 2);
    expect(recent.map((r) => r.timestamp)).toEqual(["C", "B"]);
  });
});

describe("promoteHypothesis", () => {
  it("moves a candidate to promoted in the newest entry and persists", () => {
    const loaded = freshRoutine();
    appendMemory(loaded, {
      timestamp: "2026-06-01T08:40:00Z",
      model: "mock",
      status: "ok",
      hypotheses: ["keep me", "promote me"],
    });

    const { promoted } = promoteHypothesis(loaded, { hypothesisIndex: 1 });
    expect(promoted).toBe("promote me");

    const records = parseMemory(readFileSync(join(loaded.dir, "memory.md"), "utf8"));
    expect(records[0]!.hypotheses).toEqual(["keep me"]);
    expect(records[0]!.promoted).toEqual(["promote me"]);
  });

  it("throws on an out-of-range hypothesis index", () => {
    const loaded = freshRoutine();
    appendMemory(loaded, {
      timestamp: "t",
      model: "mock",
      status: "ok",
      hypotheses: ["only"],
    });
    expect(() => promoteHypothesis(loaded, { hypothesisIndex: 5 })).toThrow(/out of range/);
  });
});
