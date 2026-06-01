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
  const dir = mkdtempSync(join(tmpdir(), "central-dcc-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T08:40:00Z");

describe("daily-command-center routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("daily-command-center");
    expect(routine.trigger.type).toBe("schedule");
    expect(routine.trigger.cron).toBe("40 8 * * *");
    expect(routine.guards.write_allowed).toBe(false);
    expect(routine.sources.map((s) => s.id)).toContain("gmail");
  });

  it("produces a valid fixed-format brief with all five sections and top3 <= 3", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: INPUTS,
      now: FIXED,
    });

    expect(result.status).toBe("ok");
    expect(result.failures).toHaveLength(0);

    const json = result.json as Record<string, unknown[]>;
    for (const key of ["top3", "calendar", "follow_ups", "blocked", "problems"]) {
      expect(json).toHaveProperty(key);
    }
    expect((json.top3 as unknown[]).length).toBeLessThanOrEqual(3);

    // The rendered markdown carries the human-facing sections.
    for (const heading of ["Top 3", "Calendar", "Follow-ups", "Blocked", "Problems"]) {
      expect(result.markdown).toContain(heading);
    }
  });

  it("rejects a brief with 4 Top-3 items, surfacing visible failures", async () => {
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
