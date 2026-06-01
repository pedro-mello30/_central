import { describe, expect, it } from "vitest";
import { defaultRunner, which } from "./exec.js";

describe("which", () => {
  it("returns true for a binary that exists on PATH", () => {
    expect(which("node", process.env.PATH ?? "")).toBe(true);
  });

  it("returns false for a binary that is not on PATH", () => {
    expect(which("definitely_not_a_real_binary_xyz123")).toBe(false);
  });

  it("returns true for an absolute path that exists on disk", () => {
    expect(which("/usr/bin/env")).toBe(true);
  });

  it("returns false for an absolute path that does not exist", () => {
    expect(which("/nonexistent/path/to/binary_xyz123")).toBe(false);
  });
});

describe("defaultRunner", () => {
  it("captures stdout and resolves with exit 0", async () => {
    const result = await defaultRunner("node", ["-e", "process.stdout.write('hello')"], "");
    expect(result.exitStatus).toBe(0);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("");
  });

  it("captures stderr and resolves with non-zero exit without rejecting", async () => {
    const result = await defaultRunner(
      "node",
      ["-e", "process.stderr.write('err'); process.exit(2)"],
      "",
    );
    expect(result.exitStatus).toBe(2);
    expect(result.stderr).toBe("err");
  });

  it("pipes stdin to the process", async () => {
    const script =
      "let d=''; process.stdin.on('data', c => d+=c); process.stdin.on('end', () => process.stdout.write(d.trim()))";
    const result = await defaultRunner("node", ["-e", script], "piped-input");
    expect(result.exitStatus).toBe(0);
    expect(result.stdout).toBe("piped-input");
  });
});
