// Learning-loop state: pure read/transform helpers over the state/ store.
// No I/O here — strings/records in, strings/records out (mirrors core/memory.ts).
// The only writer is run.ts `apply`; this module just computes the new state.

export type Kind = "learning" | "hypothesis" | "decision";

export interface Transition {
  at: string;
  actor: string;
  reason: string;
  op_id: string;
}

export interface LearningRecord {
  id: string;
  created: string;
  kind: Kind;
  status: string;
  text: string;
  origin: string;
  supersedes: string | null;
  last_transition: Transition;
}

/** Context an operation needs to stamp a record/transition (dependency-injected). */
export interface TransitionCtx {
  id: string;
  now: string;
  actor: string;
  reason: string;
  op_id: string;
}

export interface RecordInput {
  kind: Kind;
  status: string;
  text: string;
  origin: string;
  supersedes?: string | null;
}

export interface TaskProposal {
  op: "task";
  title: string;
  origin: string;
  target: string;
}

export interface LinearPayload {
  target: string;
  title: string;
  origin: string;
}

export interface RoutineHealth {
  name: string;
  last_run: string;
  sla_hours: number;
  status: string;
}

const STATUS_BY_KIND: Record<Kind, readonly string[]> = {
  learning: ["candidate", "promoted", "archived", "rejected"],
  hypothesis: ["candidate", "promoted", "archived", "rejected"],
  decision: ["active", "archived"],
};

/** Per-kind status table — the structural guarantee behind "no decision/candidate". */
export function isValidStatus(kind: Kind, status: string): boolean {
  return STATUS_BY_KIND[kind]?.includes(status) ?? false;
}

function assertStatus(kind: Kind, status: string): void {
  if (!isValidStatus(kind, status)) {
    throw new Error(
      `invalid status "${status}" for kind "${kind}" (allowed: ${STATUS_BY_KIND[kind].join(", ")})`,
    );
  }
}

function transitionOf(ctx: TransitionCtx): Transition {
  return { at: ctx.now, actor: ctx.actor, reason: ctx.reason, op_id: ctx.op_id };
}

/** Append a new record (stamping id/created/last_transition). Pure: returns a new array. */
export function addRecord(
  records: LearningRecord[],
  input: RecordInput,
  ctx: TransitionCtx,
): LearningRecord[] {
  assertStatus(input.kind, input.status);
  const record: LearningRecord = {
    id: ctx.id,
    created: ctx.now,
    kind: input.kind,
    status: input.status,
    text: input.text,
    origin: input.origin,
    supersedes: input.supersedes ?? null,
    last_transition: transitionOf(ctx),
  };
  return [...records, record];
}

function findOrThrow(records: LearningRecord[], id: string): LearningRecord {
  const r = records.find((x) => x.id === id);
  if (!r) throw new Error(`no record with id "${id}"`);
  return r;
}

/** Flip a record's status in place (returns a new array; inputs untouched). */
export function transitionRecord(
  records: LearningRecord[],
  id: string,
  to: string,
  ctx: TransitionCtx,
): LearningRecord[] {
  const target = findOrThrow(records, id);
  assertStatus(target.kind, to);
  return records.map((r) =>
    r.id === id ? { ...r, status: to, last_transition: transitionOf(ctx) } : r,
  );
}

/**
 * Correct a record: write a NEW record (carrying the old kind/status) that supersedes
 * the old one, and archive the old one. Text is never edited in place — history is kept.
 */
export function correctRecord(
  records: LearningRecord[],
  id: string,
  newText: string,
  ctx: TransitionCtx,
): LearningRecord[] {
  const old = findOrThrow(records, id);
  const archived = records.map((r) =>
    r.id === id ? { ...r, status: "archived", last_transition: transitionOf(ctx) } : r,
  );
  const fresh: LearningRecord = {
    id: ctx.id,
    created: ctx.now,
    kind: old.kind,
    status: old.status,
    text: newText,
    origin: old.origin,
    supersedes: old.id,
    last_transition: transitionOf(ctx),
  };
  return [...archived, fresh];
}

/** Route a kind:task proposal to a Linear payload. Never produces a learnings record. */
export function routeTask(p: TaskProposal): LinearPayload {
  return { target: p.target, title: p.title, origin: p.origin };
}

/** Recompute index.yaml: per-status counts + routine freshness. Deterministic. */
export function reindex(records: LearningRecord[], routines: RoutineHealth[]): string {
  const counts: Record<string, number> = {};
  for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const countLines = Object.keys(counts)
    .sort()
    .map((k) => `  ${k}: ${counts[k]}`);
  const routineLines = [...routines]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (r) =>
        `  ${r.name}: { last_run: ${r.last_run}, sla_hours: ${r.sla_hours}, status: ${r.status} }`,
    );
  return (
    `schema_version: 1\n` +
    `routines:\n${routineLines.join("\n")}\n` +
    `counts:\n${countLines.join("\n")}\n`
  );
}

/** Generated, human-readable projection of decision records. Never authoritative. */
export function projectDecisions(records: LearningRecord[]): string {
  const decisions = records
    .filter((r) => r.kind === "decision")
    .sort((a, b) => a.id.localeCompare(b.id));
  const body =
    decisions.length === 0
      ? "_No decisions recorded._"
      : decisions
          .map((r) => {
            const sup = r.supersedes ? ` (supersedes ${r.supersedes})` : "";
            return `- [${r.status}] ${r.text}${sup} — \`${r.id}\``;
          })
          .join("\n");
  return `# Decisions — generated projection\n\n<!-- Generated from state/learnings.jsonl by \`apply\`. Do not edit by hand. -->\n\n${body}\n`;
}

export type Proposal =
  | { op: "add"; record: RecordInput }
  | { op: "transition"; id: string; to: string; reason: string }
  | { op: "correct"; id: string; text: string; reason: string }
  | TaskProposal
  | { op: "reindex" };

export interface ApplyResult {
  records: LearningRecord[];
  tasks: LinearPayload[];
  applied: string[];
}

/**
 * Apply an ordered list of proposals to a record set. Pure: no I/O. `mkCtx(seq)` supplies
 * the id/now/actor/op_id for each op that needs stamping (seq increments per op), so the
 * caller controls determinism. `add`/`transition`/`correct` mutate records (functionally);
 * `task` routes to Linear and never touches the record set; `reindex` is a no-op here
 * (the index is recomputed at write time by the caller).
 */
export function applyProposals(
  records: LearningRecord[],
  proposals: Proposal[],
  mkCtx: (seq: number) => TransitionCtx,
): ApplyResult {
  let recs = records;
  const tasks: LinearPayload[] = [];
  const applied: string[] = [];

  proposals.forEach((p, seq) => {
    const ctx = mkCtx(seq);
    switch (p.op) {
      case "add":
        recs = addRecord(recs, p.record, { ...ctx, reason: ctx.reason });
        applied.push(`add ${ctx.id}`);
        break;
      case "transition":
        recs = transitionRecord(recs, p.id, p.to, { ...ctx, reason: p.reason });
        applied.push(`transition ${p.id} -> ${p.to}`);
        break;
      case "correct":
        recs = correctRecord(recs, p.id, p.text, { ...ctx, reason: p.reason });
        applied.push(`correct ${p.id} -> ${ctx.id}`);
        break;
      case "task":
        tasks.push(routeTask(p));
        applied.push(`task -> ${p.target}: ${p.title}`);
        break;
      case "reindex":
        applied.push("reindex");
        break;
    }
  });

  return { records: recs, tasks, applied };
}

/** Serialize records to JSONL (one compact object per line). */
export function toJsonl(records: LearningRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

/** Parse JSONL into records, ignoring blank lines. */
export function parseJsonl(text: string): LearningRecord[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as LearningRecord);
}
