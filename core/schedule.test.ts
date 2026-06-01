import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadRoutine } from "./contract.js";
import { crontabLine } from "./schedule.js";

const dcc = loadRoutine(join(__dirname, "..", "routines", "daily-command-center"));
const echo = loadRoutine(join(__dirname, "..", "routines", "example-echo"));

describe("schedule", () => {
  it("emits a crontab line for a schedule routine", () => {
    const line = crontabLine(dcc, { model: "claude", repoDir: "/repo" });
    expect(line.startsWith("40 8 * * * ")).toBe(true);
    expect(line).toContain("cd /repo");
    expect(line).toContain("run.ts run daily-command-center --model claude");
    expect(line).toContain("runs/daily-command-center.log");
  });

  it("throws for a non-schedule routine", () => {
    expect(() => crontabLine(echo, { model: "mock", repoDir: "/repo" })).toThrow(/not "schedule"/);
  });
});
