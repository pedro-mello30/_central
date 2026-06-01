import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LoadedRoutine } from "./types.js";

export interface MemoryEntry {
  timestamp: string;
  model: string;
  status: "ok" | "failed";
  hypotheses?: string[];
  notes?: string;
}

/** A parsed memory record (one `## ...` block). */
export interface MemoryRecord {
  timestamp: string;
  model: string;
  status: string;
  hypotheses: string[];
  promoted: string[];
  notes?: string;
}

function memoryPath(loaded: LoadedRoutine): string {
  return join(loaded.dir, loaded.routine.learning?.memory ?? "memory.md");
}

/**
 * Append a structured entry to the routine's memory file. Hypotheses are recorded as
 * candidates; `promoted` is left for a human to fill in (hypothesis != truth).
 */
export function appendMemory(loaded: LoadedRoutine, entry: MemoryEntry): string {
  const file = loaded.routine.learning?.memory ?? "memory.md";
  const path = join(loaded.dir, file);

  const lines = [
    `## ${entry.timestamp} — ${loaded.routine.name} (${entry.model})`,
    `- status: ${entry.status}`,
    `- hypotheses: ${JSON.stringify(entry.hypotheses ?? [])}`,
    `- promoted: []`,
  ];
  if (entry.notes) lines.push(`- notes: ${entry.notes}`);
  const block = lines.join("\n") + "\n\n";

  if (!existsSync(path)) {
    writeFileSync(path, `# Memory — ${loaded.routine.name}\n\n${block}`);
  } else {
    appendFileSync(path, block);
  }
  return path;
}

function safeJsonArray(s: string | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** Parse memory markdown into structured records (file order: oldest → newest). */
export function parseMemory(text: string): MemoryRecord[] {
  const records: MemoryRecord[] = [];
  // Each entry starts with "## <timestamp> — <name> (<model>)".
  const blocks = text.split(/^## /m).slice(1);
  for (const block of blocks) {
    const header = block.split("\n", 1)[0] ?? "";
    const headerMatch = header.match(/^(\S+)\s+—\s+.+\(([^)]+)\)\s*$/);
    if (!headerMatch) continue;
    const field = (name: string): string | undefined =>
      block.match(new RegExp(`^- ${name}: (.*)$`, "m"))?.[1];
    records.push({
      timestamp: headerMatch[1]!,
      model: headerMatch[2]!,
      status: field("status") ?? "",
      hypotheses: safeJsonArray(field("hypotheses")),
      promoted: safeJsonArray(field("promoted")),
      notes: field("notes"),
    });
  }
  return records;
}

/** The most recent `n` records, newest first. */
export function readRecentMemory(loaded: LoadedRoutine, n: number): MemoryRecord[] {
  const path = memoryPath(loaded);
  if (n <= 0 || !existsSync(path)) return [];
  const all = parseMemory(readFileSync(path, "utf8"));
  return all.slice(-n).reverse();
}

/** Render recent records as a compact, read-only context block for the prompt. */
export function formatRecentForPrompt(records: MemoryRecord[]): string {
  if (records.length === 0) return "";
  const lines = records.map((r) => {
    const bits = [`${r.timestamp} — ${r.status}`];
    if (r.promoted.length) bits.push(`promoted: ${r.promoted.join("; ")}`);
    if (r.hypotheses.length) bits.push(`open hypotheses: ${r.hypotheses.join("; ")}`);
    return `- ${bits.join(" | ")}`;
  });
  return lines.join("\n");
}

export interface PromoteOptions {
  /** Which entry (0 = newest). Default: newest. */
  entryIndex?: number;
  /** Which hypothesis within that entry to promote. */
  hypothesisIndex: number;
}

/**
 * Move a candidate from `hypotheses` to `promoted` in the target entry (default newest),
 * and persist the change. Promotion is always a human action — hypothesis != truth.
 */
export function promoteHypothesis(
  loaded: LoadedRoutine,
  opts: PromoteOptions,
): { promoted: string; record: MemoryRecord } {
  const path = memoryPath(loaded);
  if (!existsSync(path)) throw new Error("no memory file to promote from");
  const text = readFileSync(path, "utf8");

  // Locate the target block in original order (newest = last block).
  const parts = text.split(/^## /m);
  const head = parts[0];
  const blocks = parts.slice(1);
  if (blocks.length === 0) throw new Error("memory has no entries");

  const fromNewest = opts.entryIndex ?? 0;
  const blockPos = blocks.length - 1 - fromNewest;
  if (blockPos < 0 || blockPos >= blocks.length) {
    throw new Error(`entry index ${fromNewest} out of range (have ${blocks.length})`);
  }

  const block = blocks[blockPos]!;
  const hyp = safeJsonArray(block.match(/^- hypotheses: (.*)$/m)?.[1]);
  const prom = safeJsonArray(block.match(/^- promoted: (.*)$/m)?.[1]);
  if (opts.hypothesisIndex < 0 || opts.hypothesisIndex >= hyp.length) {
    throw new Error(
      `hypothesis index ${opts.hypothesisIndex} out of range (have ${hyp.length})`,
    );
  }

  const [moved] = hyp.splice(opts.hypothesisIndex, 1);
  prom.push(moved!);

  let updated = block
    .replace(/^- hypotheses: .*$/m, `- hypotheses: ${JSON.stringify(hyp)}`)
    .replace(/^- promoted: .*$/m, `- promoted: ${JSON.stringify(prom)}`);

  blocks[blockPos] = updated;
  writeFileSync(path, head + blocks.map((b) => "## " + b).join(""));

  const record = parseMemory("## " + updated)[0]!;
  return { promoted: moved!, record };
}
