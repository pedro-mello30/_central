import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
  const dir = mkdtempSync(join(tmpdir(), "central-ll-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

function tmpStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "central-ll-state-"));
  tmpDirs.push(dir);
  cpSync(join(REPO, "state"), dir, { recursive: true });
  writeFileSync(join(dir, "learnings.jsonl"), "");
  return dir;
}

function mkCtx(seq: number): TransitionCtx {
  return {
    id: `lrn_2026-06-01_${String(seq).padStart(4, "0")}`,
    now: "2026-06-01T08:35:00Z",
    actor: "learning-loop",
    reason: "from run",
    op_id: `op_${String(seq).padStart(3, "0")}`,
  };
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T08:35:00Z");

describe("learning-loop routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("learning-loop");
    expect(routine.trigger.cron).toBe("35 8 * * *");
    expect(routine.guards.write_allowed).toBe(false);
  });

  it("produces schema-valid proposals via mock ok", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("ok"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("ok");
    expect(result.failures).toHaveLength(0);
    const json = result.json as { proposals: Proposal[] };
    expect(json.proposals.length).toBe(4);
  });

  it("rejects an unsupported op via mock bad, surfacing visible failures", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("bad"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });

  it("applying the proposals adds 3 knowledge records and routes the task to Linear", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("ok"), inputs: INPUTS, now: FIXED });
    const { proposals } = result.json as { proposals: Proposal[] };

    const dir = tmpStore();
    const res = applyToStore({ stateDir: dir, proposals, mkCtx });

    const recs = parseJsonl(readFileSync(join(dir, "learnings.jsonl"), "utf8"));
    expect(recs).toHaveLength(3); // task is NOT a record
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0]!.title).toBe("Send Acme the signed MSA");
    expect(recs.some((r) => r.text.includes("Acme"))).toBe(false);
  });
});
