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
  const dir = mkdtempSync(join(tmpdir(), "central-wr-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T07:30:00Z");

describe("weekly-review routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("weekly-review");
    expect(routine.trigger.cron).toBe("30 7 * * 1");
    expect(routine.guards.write_allowed).toBe(false);
  });

  it("produces a valid review with all sections and focus_next_week <= 3", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: INPUTS,
      now: FIXED,
    });
    expect(result.status).toBe("ok");
    const json = result.json as Record<string, unknown[]>;
    for (const key of ["wins", "metrics", "misses", "focus_next_week", "risks"]) {
      expect(json).toHaveProperty(key);
    }
    expect((json.focus_next_week as unknown[]).length).toBeLessThanOrEqual(3);
    for (const heading of ["Wins", "Metrics", "Misses", "Focus next week", "Risks"]) {
      expect(result.markdown).toContain(heading);
    }
  });

  it("rejects 4 focus items with visible failures", async () => {
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
});
