// I/O shell around core/state.ts: read the state/ store, apply proposals, validate every
// resulting record against the record schema, then (unless --dry-run) write the three store
// files. The ONLY writer in the engine. Writes are confined to `stateDir`.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyProposals,
  parseJsonl,
  toJsonl,
  reindex,
  projectDecisions,
  type LearningRecord,
  type Proposal,
  type RoutineHealth,
  type TransitionCtx,
  type LinearPayload,
} from "./state.js";
import { validateOutput } from "./validator.js";

export interface ApplyToStoreOpts {
  stateDir: string;
  proposals: Proposal[];
  routines?: RoutineHealth[];
  dryRun?: boolean;
  mkCtx: (seq: number) => TransitionCtx;
}

export interface ApplyToStoreResult {
  applied: string[];
  tasks: LinearPayload[];
  wrote: boolean;
  records: LearningRecord[];
}

function readRecords(stateDir: string): LearningRecord[] {
  const path = join(stateDir, "learnings.jsonl");
  if (!existsSync(path)) return [];
  return parseJsonl(readFileSync(path, "utf8"));
}

/** Apply proposals to the on-disk store. Validates before writing; --dry-run writes nothing. */
export function applyToStore(opts: ApplyToStoreOpts): ApplyToStoreResult {
  const current = readRecords(opts.stateDir);
  const { records, tasks, applied } = applyProposals(current, opts.proposals, opts.mkCtx);

  // Validate every resulting record against the record schema before persisting anything.
  const schemaPath = join(opts.stateDir, "schema", "learning.json");
  for (const r of records) {
    const v = validateOutput(r, schemaPath);
    if (!v.valid) {
      throw new Error(`invalid record ${r.id}: ${v.failures.map((f) => f.message).join("; ")}`);
    }
  }

  if (opts.dryRun) {
    return { applied, tasks, wrote: false, records };
  }

  writeFileSync(join(opts.stateDir, "learnings.jsonl"), records.length ? toJsonl(records) : "");
  writeFileSync(join(opts.stateDir, "decisions.md"), projectDecisions(records));
  writeFileSync(join(opts.stateDir, "index.yaml"), reindex(records, opts.routines ?? []));

  return { applied, tasks, wrote: true, records };
}
