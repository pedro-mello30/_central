#!/usr/bin/env -S npx tsx
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { Adapter } from "./adapters/base.js";
import { MockAdapter } from "./adapters/mock.js";
import { ClaudeAdapter } from "./adapters/claude.js";
import { CodexAdapter } from "./adapters/codex.js";
import { run } from "./core/runner.js";
import { loadRoutine } from "./core/contract.js";
import { crontabLine } from "./core/schedule.js";
import { promoteHypothesis } from "./core/memory.js";
import { applyToStore } from "./core/store.js";
import { appendRunLog, formatRunLogLine, runLogPath, toRunRecord } from "./core/runlog.js";
import { aggregate, formatMetricsTable, parseRunLog } from "./core/metrics.js";
import type { Proposal, TransitionCtx } from "./core/state.js";
import type { Inputs } from "./core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS = new Set(["run", "schedule", "promote", "apply", "metrics"]);

interface ParsedArgs {
  command: string;
  routine?: string;
  model: string;
  variant: string;
  inputs: Inputs;
  entry: number;
  hyp?: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    command: "run",
    model: "mock",
    variant: "ok",
    inputs: {},
    entry: 0,
    dryRun: false,
  };
  // First token may be a command; otherwise it's the routine (default `run`).
  let rest = argv;
  if (rest.length && rest[0] && COMMANDS.has(rest[0])) {
    args.command = rest[0];
    rest = rest.slice(1);
  }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === undefined) continue;
    if (a === "--model") args.model = rest[++i] ?? args.model;
    else if (a === "--variant") args.variant = rest[++i] ?? args.variant;
    else if (a === "--entry") args.entry = Number(rest[++i] ?? 0);
    else if (a === "--hyp") args.hyp = Number(rest[++i] ?? 0);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--input") {
      const kv = rest[++i] ?? "";
      const eq = kv.indexOf("=");
      if (eq > 0) args.inputs[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else if (!a.startsWith("--") && !args.routine) {
      args.routine = a;
    }
  }
  return args;
}

function selectAdapter(model: string, variant: string): Adapter {
  switch (model) {
    case "mock":
      return new MockAdapter(variant);
    case "claude":
      return new ClaudeAdapter();
    case "codex":
      return new CodexAdapter();
    default:
      throw new Error(`unknown model "${model}". Available: mock, claude, codex.`);
  }
}

function routineDirOf(name: string): string {
  const dir = join(__dirname, "routines", name);
  if (!existsSync(dir)) {
    console.error(`routine not found: ${dir}`);
    process.exit(2);
  }
  return dir;
}

async function cmdRun(args: ParsedArgs) {
  const defaults: Inputs = {
    date: new Date().toISOString().slice(0, 10),
    timezone: process.env.TZ ?? "UTC",
  };
  const inputs = { ...defaults, ...args.inputs };
  const adapter = selectAdapter(args.model, args.variant);
  const dir = routineDirOf(args.routine!);
  const result = await run(dir, { adapter, inputs });
  console.log(result.markdown);
  // Persist the validated output so `apply` can read this run's proposals later.
  // Run-local artifact (gitignored); never part of the run path's guarantees.
  if (result.json !== undefined) {
    writeFileSync(join(dir, ".last-run.json"), JSON.stringify(result.json, null, 2));
  }
  // Observability: append a compact record to the durable run log and emit a
  // structured one-line summary to stderr (stdout stays the clean markdown pipe).
  const record = toRunRecord(result);
  appendRunLog(__dirname, record);
  console.error(formatRunLogLine(record));
  process.exit(result.status === "ok" ? 0 : 1);
}

function readProposals(routineDir: string): Proposal[] {
  const path = join(routineDir, ".last-run.json");
  if (!existsSync(path)) {
    console.error(`no .last-run.json in ${routineDir} — run the routine first.`);
    process.exit(2);
  }
  const json = JSON.parse(readFileSync(path, "utf8")) as { proposals?: Proposal[] };
  return Array.isArray(json.proposals) ? json.proposals : [];
}

function cmdApply(args: ParsedArgs) {
  const dir = routineDirOf(args.routine!);
  const proposals = readProposals(dir);
  if (proposals.length === 0) {
    console.log(`no proposals in ${args.routine}'s last run — nothing to apply.`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const mkCtx = (_seq: number): TransitionCtx => ({
    id: `lrn_${today}_${randomBytes(2).toString("hex")}`,
    now: new Date().toISOString(),
    actor: args.routine!,
    reason: "applied from last run",
    op_id: `op_${randomBytes(3).toString("hex")}`,
  });

  const res = applyToStore({
    stateDir: join(__dirname, "state"),
    proposals,
    dryRun: args.dryRun,
    mkCtx,
  });

  console.log(`${args.dryRun ? "[dry-run] would apply" : "applied"} ${res.applied.length} op(s):`);
  for (const a of res.applied) console.log(`  - ${a}`);
  if (res.tasks.length) {
    console.log(`tasks routed to Linear (${res.tasks.length}):`);
    for (const t of res.tasks) console.log(`  - ${t.title} (${t.origin})`);
  }
  console.log(res.wrote ? "state/ updated." : "state/ unchanged.");
}

function cmdMetrics(args: ParsedArgs) {
  // Read-only rollup of the durable run log. An optional routine arg filters.
  const path = runLogPath(__dirname);
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  let records = parseRunLog(text);
  if (args.routine) records = records.filter((r) => r.routine === args.routine);
  console.log(formatMetricsTable(aggregate(records)));
}

function cmdSchedule(args: ParsedArgs) {
  const loaded = loadRoutine(routineDirOf(args.routine!));
  const line = crontabLine(loaded, { model: args.model, repoDir: __dirname });
  console.log(`# install with: (crontab -l 2>/dev/null; echo '<line>') | crontab -`);
  console.log(line);
}

function cmdPromote(args: ParsedArgs) {
  if (args.hyp === undefined) {
    console.error("usage: promote <routine> --hyp <index> [--entry <n from newest>]");
    process.exit(2);
  }
  const loaded = loadRoutine(routineDirOf(args.routine!));
  const { promoted } = promoteHypothesis(loaded, {
    entryIndex: args.entry,
    hypothesisIndex: args.hyp,
  });
  console.log(`promoted: ${promoted}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // `metrics` is a fleet-wide rollup; a routine arg is an optional filter.
  if (args.command === "metrics") return cmdMetrics(args);
  if (!args.routine) {
    console.error(
      "usage:\n" +
        "  run.ts run <routine> [--model mock|claude|codex] [--variant ok] [--input k=v]\n" +
        "  run.ts schedule <routine> [--model claude]\n" +
        "  run.ts promote <routine> --hyp <i> [--entry <n>]\n" +
        "  run.ts apply <routine> [--dry-run]\n" +
        "  run.ts metrics [<routine>]",
    );
    process.exit(2);
  }
  switch (args.command) {
    case "schedule":
      return cmdSchedule(args);
    case "promote":
      return cmdPromote(args);
    case "apply":
      return cmdApply(args);
    default:
      return cmdRun(args);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
