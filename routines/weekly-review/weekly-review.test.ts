import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { loadRoutine } from "../../core/contract.js";
import { runLoaded } from "../../core/runner.js";
import { MockAdapter } from "../../adapters/mock.js";
import { applyToStore } from "../../core/store.js";
import { parseJsonl, type Proposal, type TransitionCtx } from "../../core/state.js";
import type { LoadedRoutine } from "../../core/types.js";

const SRC = __dirname;
const REPO = dirname(dirname(SRC));
const tmpDirs: string[] = [];

function tmpRoutine(): LoadedRoutine {
  const dir = mkdtempSync(join(tmpdir(), "central-wr-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

function mkCtx(seq: number): TransitionCtx {
  return {
    id: `lrn_2026-06-08_${String(seq).padStart(4, "0")}`,
    now: "2026-06-08T07:30:00Z",
    actor: "weekly-review",
    reason: "from run",
    op_id: `op_${String(seq).padStart(3, "0")}`,
  };
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T07:30:00Z");

describe("weekly-review routine (curator)", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("weekly-review");
    expect(routine.trigger.cron).toBe("30 7 * * 1");
    expect(routine.guards.write_allowed).toBe(false);
  });

  it("produces lifecycle proposals via mock ok", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: INPUTS,
      now: FIXED,
    });
    expect(result.status).toBe("ok");
    const json = result.json as { proposals: { op: string }[] };
    expect(json.proposals.length).toBe(4);
    expect(json.proposals.map((p) => p.op)).toContain("transition");
    expect(json.proposals.map((p) => p.op)).toContain("correct");
    for (const heading of ["Promote", "Demote", "Archive", "Correct"]) {
      expect(result.markdown).toContain(heading);
    }
  });

  it("rejects an unsupported op via mock bad", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("bad"),
      inputs: INPUTS,
      now: FIXED,
    });
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });

  it("applying a promote transition flips a candidate to promoted in the store", async () => {
    // Seed a store with one candidate, then apply a promote proposal for it.
    const dir = mkdtempSync(join(tmpdir(), "central-wr-state-"));
    tmpDirs.push(dir);
    cpSync(join(REPO, "state"), dir, { recursive: true });
    const seeded = {
      id: "lrn_2026-05-25_aa12",
      created: "2026-05-25T00:00:00Z",
      kind: "learning",
      status: "candidate",
      text: "SSO before pricing",
      origin: "granola:x",
      supersedes: null,
      last_transition: {
        at: "2026-05-25T00:00:00Z",
        actor: "learning-loop",
        reason: "seed",
        op_id: "op_seed",
      },
    };
    writeFileSync(join(dir, "learnings.jsonl"), JSON.stringify(seeded) + "\n");

    const proposals: Proposal[] = [
      { op: "transition", id: "lrn_2026-05-25_aa12", to: "promoted", reason: "seen in 5 calls" },
    ];
    applyToStore({ stateDir: dir, proposals, mkCtx });

    const recs = parseJsonl(readFileSync(join(dir, "learnings.jsonl"), "utf8"));
    expect(recs[0]!.status).toBe("promoted");
  });
});
