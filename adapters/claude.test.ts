import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { ClaudeAdapter } from "./claude.js";
import { loadRoutine } from "../core/contract.js";
import type { CommandResult } from "../core/exec.js";

const loaded = loadRoutine(join(__dirname, "..", "routines", "example-echo"));

describe("ClaudeAdapter", () => {
  it("pipes the prompt to `claude -p` stdin and returns stdout", async () => {
    const runner = vi.fn(
      async (): Promise<CommandResult> => ({
        stdout: "model said hi",
        stderr: "",
        exitStatus: 0,
      }),
    );
    const adapter = new ClaudeAdapter({ runner, which: () => true });
    const result = await adapter.run("COMPOSED PROMPT", { loaded });

    expect(runner).toHaveBeenCalledWith("claude", ["-p"], "COMPOSED PROMPT");
    expect(result).toEqual({ raw: "model said hi", exitStatus: 0 });
  });

  it("appends stderr to raw on non-zero exit", async () => {
    const runner = async (): Promise<CommandResult> => ({
      stdout: "partial",
      stderr: "boom",
      exitStatus: 2,
    });
    const adapter = new ClaudeAdapter({ runner, which: () => true });
    const result = await adapter.run("p", { loaded });
    expect(result.exitStatus).toBe(2);
    expect(result.raw).toContain("boom");
  });

  it("preflight fails when the binary is absent and passes when present", () => {
    expect(new ClaudeAdapter({ which: () => false }).preflight()).toHaveLength(1);
    expect(new ClaudeAdapter({ which: () => true }).preflight()).toHaveLength(0);
  });
});
