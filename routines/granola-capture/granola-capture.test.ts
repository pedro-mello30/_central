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
  const dir = mkdtempSync(join(tmpdir(), "central-gc-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T08:30:00Z");

describe("granola-capture routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("granola-capture");
    expect(routine.trigger.cron).toBe("30 8 * * *");
    expect(routine.guards.write_allowed).toBe(false);
  });

  it("captures typed items via mock ok", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("ok"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("ok");
    const json = result.json as { captured: { type: string }[] };
    expect(json.captured.length).toBe(4);
    expect(json.captured.map((c) => c.type)).toContain("objection");
  });

  it("rejects an unsupported capture type via mock bad", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("bad"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });
});
