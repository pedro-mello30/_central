import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadRoutine } from "./contract.js";
import { composePrompt } from "./compose.js";

const loaded = loadRoutine(join(__dirname, "..", "routines", "example-echo"));

describe("compose", () => {
  it("is deterministic for the same inputs", () => {
    const a = composePrompt(loaded, { name: "Pedro", date: "2026-06-01" });
    const b = composePrompt(loaded, { date: "2026-06-01", name: "Pedro" });
    expect(a).toBe(b);
  });

  it("includes goal, criteria, inputs and the output contract", () => {
    const p = composePrompt(loaded, { name: "Pedro", date: "2026-06-01" });
    expect(p).toContain(loaded.routine.goal);
    expect(p).toContain("Judgment criteria");
    expect(p).toContain("name: Pedro");
    expect(p).toContain("schema.json");
    expect(p).toContain("write_allowed: false");
  });

  it("is byte-identical with no options vs an empty recentMemory", () => {
    const a = composePrompt(loaded, { name: "P", date: "2026-06-01" });
    const b = composePrompt(loaded, { name: "P", date: "2026-06-01" }, {});
    const c = composePrompt(loaded, { name: "P", date: "2026-06-01" }, { recentMemory: "" });
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("adds a read-only context section when recentMemory is provided", () => {
    const p = composePrompt(
      loaded,
      { name: "P", date: "2026-06-01" },
      { recentMemory: "- 2026-05-31 — ok | open hypotheses: Lead X stale?" },
    );
    expect(p).toContain("## Recent memory (read-only context)");
    expect(p).toContain("Lead X stale?");
  });
});
