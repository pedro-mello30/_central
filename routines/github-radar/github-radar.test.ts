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
  const dir = mkdtempSync(join(tmpdir(), "central-gh-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T08:00:00Z");

describe("github-radar routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("github-radar");
    expect(routine.trigger.cron).toBe("0 8 * * *");
    expect(routine.sources.find((s) => s.id === "trending")?.trust).toBe("hypothesis");
  });

  it("produces a valid classified digest", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: INPUTS,
      now: FIXED,
    });
    expect(result.status).toBe("ok");
    const json = result.json as Record<string, unknown>;
    const items = json.items as { kind: string; priority: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(10);
    for (const i of items) {
      expect(i.kind.length).toBeGreaterThan(0);
      expect(["act-now", "watch"]).toContain(i.priority);
    }
    for (const heading of ["Act now", "Watch", "What to ignore", "Themes"]) {
      expect(result.markdown).toContain(heading);
    }
  });

  it("rejects an out-of-enum priority with visible failures", async () => {
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
