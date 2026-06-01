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
  const dir = mkdtempSync(join(tmpdir(), "central-lr-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T18:00:00Z");

describe("linkedin-radar routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("linkedin-radar");
    expect(routine.trigger.cron).toBe("0 18 * * *");
    expect(routine.sources.find((s) => s.id === "news")?.trust).toBe("hypothesis");
  });

  it("produces a valid radar with exactly 3 post angles", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: INPUTS,
      now: FIXED,
    });
    expect(result.status).toBe("ok");
    const json = result.json as Record<string, unknown[]>;
    expect((json.post_angles as unknown[]).length).toBe(3);
    for (const heading of ["Signals", "Post angles", "Themes"]) {
      expect(result.markdown).toContain(heading);
    }
  });

  it("rejects fewer than 3 post angles with visible failures", async () => {
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
