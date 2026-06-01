import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadRoutine } from "./contract.js";
import { preflight } from "./preflight.js";
import type { LoadedRoutine } from "./types.js";

const loaded = loadRoutine(join(__dirname, "..", "routines", "example-echo"));

describe("preflight", () => {
  it("passes when all inputs resolved and guards coherent", () => {
    const failures = preflight(loaded, { date: "2026-06-01", name: "Pedro" }, "non-empty");
    expect(failures).toHaveLength(0);
  });

  it("flags a missing required input", () => {
    const failures = preflight(loaded, { date: "2026-06-01" }, "non-empty");
    expect(failures.some((f) => f.message.includes('"name"'))).toBe(true);
  });

  it("flags incoherent guards (write_allowed=false but max_files_changed>0)", () => {
    const incoherent: LoadedRoutine = {
      dir: loaded.dir,
      routine: {
        ...loaded.routine,
        guards: { write_allowed: false, max_files_changed: 3 },
      },
    };
    const failures = preflight(incoherent, { date: "x", name: "y" }, "non-empty");
    expect(failures.some((f) => f.message.includes("incoherent guards"))).toBe(true);
  });

  it("flags an empty composed prompt", () => {
    const failures = preflight(loaded, { date: "x", name: "y" }, "   ");
    expect(failures.some((f) => f.message.includes("empty"))).toBe(true);
  });
});
