import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadRoutine, parseRoutine, RoutineValidationError } from "./contract.js";

const ROUTINE_DIR = join(__dirname, "..", "routines", "example-echo");

describe("contract", () => {
  it("loads and validates the example routine", () => {
    const { routine } = loadRoutine(ROUTINE_DIR);
    expect(routine.name).toBe("example-echo");
    expect(routine.version).toBe(1);
    expect(routine.guards.write_allowed).toBe(false);
    expect(routine.outputs.schema).toBe("schema.json");
  });

  it("rejects a routine missing goal with a typed error", () => {
    const bad = `name: broken\nversion: 1\ntrigger:\n  type: manual\noutputs:\n  format: markdown\nguards:\n  write_allowed: false\n`;
    expect(() => parseRoutine(bad)).toThrow(RoutineValidationError);
  });

  it("rejects a non-kebab-case name", () => {
    const bad = `name: BadName\nversion: 1\ngoal: x\ntrigger:\n  type: manual\noutputs:\n  format: markdown\nguards:\n  write_allowed: false\n`;
    expect(() => parseRoutine(bad)).toThrow(RoutineValidationError);
  });
});
