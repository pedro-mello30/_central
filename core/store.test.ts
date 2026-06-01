import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { applyToStore } from "./store.js";
import { parseJsonl, type Proposal, type TransitionCtx } from "./state.js";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_STATE = join(REPO, "state");
const tmpDirs: string[] = [];

function tmpStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "central-state-"));
  tmpDirs.push(dir);
  cpSync(SRC_STATE, dir, { recursive: true });
  writeFileSync(join(dir, "learnings.jsonl"), "");
  return dir;
}

function mkCtx(seq: number): TransitionCtx {
  return {
    id: `lrn_2026-06-01_${String(seq).padStart(4, "0")}`,
    now: "2026-06-01T08:40:00Z",
    actor: "learning-loop",
    reason: "from run",
    op_id: `op_${String(seq).padStart(3, "0")}`,
  };
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const ADD: Proposal = {
  op: "add",
  record: { kind: "decision", status: "active", text: "Adopt usage-based pricing", origin: "granola:m1" },
};

describe("core/store — applyToStore", () => {
  it("--dry-run writes nothing to the store", () => {
    const dir = tmpStore();
    const before = readFileSync(join(dir, "learnings.jsonl"), "utf8");
    const res = applyToStore({ stateDir: dir, proposals: [ADD], dryRun: true, mkCtx });

    expect(res.wrote).toBe(false);
    expect(readFileSync(join(dir, "learnings.jsonl"), "utf8")).toBe(before);
    // it still reports what it WOULD do
    expect(res.applied).toContain("add lrn_2026-06-01_0000");
  });

  it("persists records, regenerates decisions.md, and reindexes", () => {
    const dir = tmpStore();
    const res = applyToStore({
      stateDir: dir,
      proposals: [ADD],
      routines: [{ name: "learning-loop", last_run: "2026-06-01T08:35:00Z", sla_hours: 26, status: "fresh" }],
      mkCtx,
    });

    expect(res.wrote).toBe(true);
    const recs = parseJsonl(readFileSync(join(dir, "learnings.jsonl"), "utf8"));
    expect(recs).toHaveLength(1);
    expect(readFileSync(join(dir, "decisions.md"), "utf8")).toContain("Adopt usage-based pricing");
    expect(readFileSync(join(dir, "index.yaml"), "utf8")).toContain("active: 1");
  });

  it("refuses an invalid proposal and writes nothing", () => {
    const dir = tmpStore();
    const bad: Proposal = { op: "add", record: { kind: "decision", status: "candidate", text: "x", origin: "o" } };
    expect(() => applyToStore({ stateDir: dir, proposals: [bad], mkCtx })).toThrow();
    expect(readFileSync(join(dir, "learnings.jsonl"), "utf8")).toBe("");
  });

  it("routes a task to Linear without adding a learnings record", () => {
    const dir = tmpStore();
    const res = applyToStore({
      stateDir: dir,
      proposals: [{ op: "task", title: "Email Acme", origin: "granola:m1", target: "linear" }],
      mkCtx,
    });
    expect(res.tasks).toHaveLength(1);
    expect(parseJsonl(readFileSync(join(dir, "learnings.jsonl"), "utf8"))).toHaveLength(0);
  });

  it("writes only within the state dir (the three known files)", () => {
    const dir = tmpStore();
    applyToStore({ stateDir: dir, proposals: [ADD], mkCtx });
    const entries = readdirSync(dir).sort();
    expect(entries).toEqual(["decisions.md", "index.yaml", "learnings.jsonl", "schema"]);
  });
});
