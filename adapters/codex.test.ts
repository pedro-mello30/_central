import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { CodexAdapter } from "./codex.js";
import { loadRoutine } from "../core/contract.js";
import type { CommandResult } from "../core/exec.js";

const loaded = loadRoutine(join(__dirname, "..", "routines", "example-echo"));

describe("CodexAdapter", () => {
  it("pipes the prompt to `codex exec` stdin and returns stdout", async () => {
    const runner = vi.fn(
      async (): Promise<CommandResult> => ({
        stdout: "codex output",
        stderr: "",
        exitStatus: 0,
      }),
    );
    const adapter = new CodexAdapter({ runner, which: () => true });
    const result = await adapter.run("COMPOSED PROMPT", { loaded });

    expect(runner).toHaveBeenCalledWith("codex", ["exec"], "COMPOSED PROMPT");
    expect(result).toEqual({ raw: "codex output", exitStatus: 0 });
  });

  it("preflight fails when the binary is absent and passes when present", () => {
    expect(new CodexAdapter({ which: () => false }).preflight()).toHaveLength(1);
    expect(new CodexAdapter({ which: () => true }).preflight()).toHaveLength(0);
  });
});
