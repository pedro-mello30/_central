import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRoutine } from "./contract.js";
import { runLoaded } from "./runner.js";
import { MockAdapter } from "../adapters/mock.js";
import type { AdapterOpts } from "../adapters/base.js";
import type { LoadedRoutine } from "./types.js";

const SRC = join(__dirname, "..", "routines", "example-echo");
const DCC = join(__dirname, "..", "routines", "daily-command-center");
const tmpDirs: string[] = [];

/** Copy a routine to a temp dir so memory writes don't dirty the repo. */
function tmpRoutine(src: string = SRC): LoadedRoutine {
  const dir = mkdtempSync(join(tmpdir(), "central-routine-"));
  tmpDirs.push(dir);
  cpSync(src, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const FIXED = () => new Date("2026-06-01T08:40:00Z");

describe("runner", () => {
  it("runs the ok path, validates output, and appends memory", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: { date: "2026-06-01", name: "Pedro" },
      now: FIXED,
    });

    expect(result.status).toBe("ok");
    expect(result.failures).toHaveLength(0);
    expect(result.json).toEqual({ message: "Hello, Pedro!", name: "Pedro" });

    const mem = readFileSync(join(loaded.dir, "memory.md"), "utf8");
    expect(mem).toContain("status: ok");
    expect(mem).toContain("example-echo (mock)");
  });

  it("stamps a run id, timing, and captured hypotheses on the result", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: { date: "2026-06-01", name: "Pedro" },
      now: FIXED,
      mkRunId: () => "run_fixed_abc123",
    });

    expect(result.runId).toBe("run_fixed_abc123");
    expect(result.startedAt).toBe("2026-06-01T08:40:00.000Z");
    expect(result.finishedAt).toBe("2026-06-01T08:40:00.000Z");
    expect(result.durationMs).toBe(0);
    expect(result.hypotheses).toEqual([]);
  });

  it("generates a unique run id when none is injected", async () => {
    const loaded = tmpRoutine();
    const a = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: { date: "x", name: "P" },
    });
    const b = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: { date: "x", name: "P" },
    });
    expect(a.runId).toMatch(/^run_/);
    expect(a.runId).not.toBe(b.runId);
  });

  it("fails visibly when output violates the schema", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, {
      adapter: new MockAdapter("bad"),
      inputs: { date: "2026-06-01", name: "Pedro" },
      now: FIXED,
    });

    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });

  it("blocks the run when adapter preflight fails (binary missing), without spawning", async () => {
    const loaded = tmpRoutine();
    let ran = false;
    const adapter = {
      name: "claude",
      preflight: () => [{ stage: "preflight" as const, message: "claude CLI not found on PATH" }],
      run: async () => {
        ran = true;
        return { raw: "should not happen", exitStatus: 0 };
      },
    };
    const result = await runLoaded(loaded, {
      adapter,
      inputs: { date: "2026-06-01", name: "Pedro" },
      now: FIXED,
    });

    expect(ran).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("claude CLI not found on PATH");
  });

  it("fails in preflight on a missing input without calling the adapter", async () => {
    const loaded = tmpRoutine();
    let called = false;
    const spy = new MockAdapter("ok");
    const wrapped = {
      name: "spy",
      run: async (p: string, o: AdapterOpts) => {
        called = true;
        return spy.run(p, o);
      },
    };
    const result = await runLoaded(loaded, {
      adapter: wrapped,
      inputs: { date: "2026-06-01" }, // missing "name"
      now: FIXED,
    });

    expect(called).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.failures.some((f) => f.stage === "preflight")).toBe(true);
  });
});

describe("runner memory loop", () => {
  const INPUTS = { date: "2026-06-01", timezone: "UTC" };

  it("captures output hypotheses into memory and feeds them to the next run", async () => {
    const loaded = tmpRoutine(DCC);

    // First run: the ok fixture's `problems` become captured hypotheses.
    const first = await runLoaded(loaded, {
      adapter: new MockAdapter("ok"),
      inputs: INPUTS,
      now: FIXED,
    });
    expect(first.status).toBe("ok");

    const mem = readFileSync(join(loaded.dir, "memory.md"), "utf8");
    expect(mem).toContain("Could not read the repos source");

    // Second run: prior memory is fed into the composed prompt as context.
    const seenPrompts: string[] = [];
    const spy = new MockAdapter("ok");
    const wrapped = {
      name: "claude",
      run: async (p: string, o: AdapterOpts) => {
        seenPrompts.push(p);
        return spy.run(p, o);
      },
    };
    await runLoaded(loaded, { adapter: wrapped, inputs: INPUTS, now: FIXED });

    expect(seenPrompts[0]).toContain("## Recent memory (read-only context)");
    expect(seenPrompts[0]).toContain("Could not read the repos source");
  });
});
