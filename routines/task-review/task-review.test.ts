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
  const dir = mkdtempSync(join(tmpdir(), "central-tr-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC" };
const FIXED = () => new Date("2026-06-01T08:50:00Z");

describe("task-review routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("task-review");
    expect(routine.trigger.cron).toBe("50 8 * * *");
    expect(routine.guards.write_allowed).toBe(false);
    expect(routine.guards.max_files_changed).toBe(0);
  });

  it("produces queue, top5, and drafts via mock ok", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("ok"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("ok");
    const json = result.json as {
      queue: unknown[];
      top5: unknown[];
      drafts: { task: string; comment: string }[];
    };
    expect(json.queue.length).toBeGreaterThan(0);
    expect(json.top5.length).toBeLessThanOrEqual(5);
    expect(json.drafts.every((d) => d.comment.length > 0)).toBe(true);
  });

  it("rejects an unsupported queue status via mock bad", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("bad"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });
});
