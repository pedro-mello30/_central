import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitStatus: number;
}

/**
 * Runs a command, writing `input` to its stdin, and resolves with the captured
 * output + exit code. Never rejects on a non-zero exit — that is data, not an error.
 */
export type CommandRunner = (cmd: string, args: string[], input: string) => Promise<CommandResult>;

export const defaultRunner: CommandRunner = (cmd, args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject); // e.g. ENOENT if the binary vanished after preflight
    child.on("close", (code) => resolve({ stdout, stderr, exitStatus: code ?? 0 }));
    child.stdin.end(input);
  });

/** True if `bin` is found on PATH (dependency-free, injectable for tests). */
export function which(bin: string, pathEnv: string = process.env.PATH ?? ""): boolean {
  if (bin.includes("/")) return existsSync(bin);
  return pathEnv
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => existsSync(join(dir, bin)));
}

export type WhichFn = (bin: string) => boolean;
