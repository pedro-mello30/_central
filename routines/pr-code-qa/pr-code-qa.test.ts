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
  const dir = mkdtempSync(join(tmpdir(), "central-pcq-"));
  tmpDirs.push(dir);
  cpSync(SRC, dir, { recursive: true });
  return loadRoutine(dir);
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const INPUTS = { date: "2026-06-01", timezone: "UTC", pr: "acme/api#482" };
const FIXED = () => new Date("2026-06-01T12:00:00Z");

const DIMENSIONS = [
  "intent",
  "scope",
  "correctness",
  "tests",
  "readability",
  "security",
  "performance",
  "api-contract",
];

describe("pr-code-qa routine", () => {
  it("loads and validates against the engine contract", () => {
    const { routine } = loadRoutine(SRC);
    expect(routine.name).toBe("pr-code-qa");
    expect(routine.trigger.type).toBe("github");
    expect(routine.guards.write_allowed).toBe(false);
    expect(routine.guards.max_files_changed).toBe(0);
    expect(routine.sources.find((s) => s.id === "pr")?.trust).toBe("source");
  });

  it("produces a full scorecard, verdict, and rule-tagged critiques via mock ok", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("ok"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("ok");
    const json = result.json as {
      verdict: string;
      scorecard: { dimension: string }[];
      briefing_match: Record<string, { aligned: boolean }>;
      critiques: { severity: string; dimension: string }[];
    };
    // All eight dimensions, exactly once.
    expect(json.scorecard.map((s) => s.dimension).sort()).toEqual([...DIMENSIONS].sort());
    expect(["approve", "revise", "block"]).toContain(json.verdict);
    // A blocker critique forces a block verdict.
    if (json.critiques.some((c) => c.severity === "blocker")) {
      expect(json.verdict).toBe("block");
    }
    expect(Object.keys(json.briefing_match).sort()).toEqual(
      ["acceptance", "conventions", "issue", "scope"],
    );
    for (const heading of ["Scorecard", "Briefing match", "Verdict", "Critiques"]) {
      expect(result.markdown).toContain(heading);
    }
  });

  it("rejects an incomplete scorecard via mock bad", async () => {
    const loaded = tmpRoutine();
    const result = await runLoaded(loaded, { adapter: new MockAdapter("bad"), inputs: INPUTS, now: FIXED });
    expect(result.status).toBe("failed");
    expect(result.markdown).toContain("## ⚠️ Failures");
    expect(result.failures.some((f) => f.stage === "validate")).toBe(true);
  });
});
