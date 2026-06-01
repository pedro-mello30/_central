import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRoutine } from "../../core/contract.js";
import { runLoaded } from "../../core/runner.js";
import { MockAdapter } from "../../adapters/mock.js";
import type { LoadedRoutine } from "../../core/types.js";

const SRC = __dirname;
const tmpDirs: string[] = [];

function tmpRoutine(): LoadedRoutine {
  const dir = mkdtempSync(join(tmpdir(), "central-wd-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T09:00:00Z");

describe("watchdog routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("watchdog");
    expect(routine.trigger.cron).toBe("0 9 * * *");
    expect(routine.guards.write_allowed).toBe(false);
  });

  it("reports checks and proposes reindex on drift via mock ok", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("ok"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("ok");
    const json = result.json as { checks: unknown[]; proposals: { op: string }[] };
    expect(json.checks.length).toBe(4);
    expect(json.proposals.some((p) => p.op === "reindex")).toBe(true);
  });

  it("rejects an unsupported check status via mock bad", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("bad"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });
});
