import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { extractJsonBlock, validateOutput } from "./validator.js";

const SCHEMA = join(__dirname, "..", "routines", "example-echo", "schema.json");

describe("validator", () => {
  it("extracts the json block from model output", () => {
    const raw = "Hi\n\n```json\n{ \"message\": \"Hello\", \"name\": \"P\" }\n```\n";
    expect(extractJsonBlock(raw)).toEqual({ message: "Hello", name: "P" });
  });

  it("returns undefined when there is no json block", () => {
    expect(extractJsonBlock("just prose")).toBeUndefined();
  });

  it("passes a valid output", () => {
    const r = validateOutput({ message: "Hi", name: "P" }, SCHEMA);
    expect(r.valid).toBe(true);
  });

  it("fails an output missing a required field", () => {
    const r = validateOutput({ message: "Hi" }, SCHEMA);
    expect(r.valid).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
  });
});
