import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { MockAdapter } from "./mock.js";
import { loadRoutine } from "../core/contract.js";

const loaded = loadRoutine(join(__dirname, "..", "routines", "example-echo"));

describe("MockAdapter", () => {
  it("returns exit 1 with a descriptive message when the fixture is absent", async () => {
    const adapter = new MockAdapter("nonexistent-variant");
    const result = await adapter.run("", { loaded });
    expect(result.exitStatus).toBe(1);
    expect(result.raw).toContain("nonexistent-variant");
  });
});
