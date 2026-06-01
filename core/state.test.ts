import { describe, expect, it } from "vitest";
import {
  addRecord,
  transitionRecord,
  correctRecord,
  routeTask,
  reindex,
  projectDecisions,
  isValidStatus,
  parseJsonl,
  toJsonl,
  type LearningRecord,
  type TransitionCtx,
} from "./state.js";

const CTX: TransitionCtx = {
  id: "lrn_2026-06-01_aaaa",
  now: "2026-06-01T08:40:00Z",
  actor: "learning-loop",
  reason: "captured in standup",
  op_id: "op_001",
};

function seed(): LearningRecord[] {
  return addRecord(
    [],
    {
      kind: "hypothesis",
      status: "candidate",
      text: "Pricing is too low for enterprise",
      origin: "granola:m1",
    },
    CTX,
  );
}

describe("core/state — records", () => {
  it("addRecord stamps id, created, and last_transition", () => {
    const recs = seed();
    expect(recs).toHaveLength(1);
    const r = recs[0]!;
    expect(r.id).toBe("lrn_2026-06-01_aaaa");
    expect(r.created).toBe("2026-06-01T08:40:00Z");
    expect(r.kind).toBe("hypothesis");
    expect(r.status).toBe("candidate");
    expect(r.supersedes).toBeNull();
    expect(r.last_transition).toEqual({
      at: "2026-06-01T08:40:00Z",
      actor: "learning-loop",
      reason: "captured in standup",
      op_id: "op_001",
    });
  });

  it("addRecord rejects a status that is invalid for the kind", () => {
    expect(() =>
      addRecord([], { kind: "decision", status: "candidate", text: "x", origin: "o" }, CTX),
    ).toThrow(/decision/);
  });

  it("transitionRecord flips status and last_transition in place", () => {
    const recs = seed();
    const next = transitionRecord(recs, "lrn_2026-06-01_aaaa", "promoted", {
      ...CTX,
      now: "2026-06-08T07:30:00Z",
      actor: "weekly-review",
      reason: "seen in 5 calls",
      op_id: "op_002",
    });
    expect(next[0]!.status).toBe("promoted");
    expect(next[0]!.last_transition.actor).toBe("weekly-review");
    expect(next[0]!.last_transition.op_id).toBe("op_002");
    // immutability: original array's record is untouched
    expect(recs[0]!.status).toBe("candidate");
  });

  it("transitionRecord rejects a status invalid for the record's kind", () => {
    const recs = seed();
    expect(() => transitionRecord(recs, "lrn_2026-06-01_aaaa", "active", CTX)).toThrow();
  });

  it("correctRecord writes a new record that supersedes the old, and archives the old", () => {
    const recs = seed();
    const next = correctRecord(recs, "lrn_2026-06-01_aaaa", "Pricing is too low for mid-market", {
      ...CTX,
      id: "lrn_2026-06-08_bbbb",
      now: "2026-06-08T07:30:00Z",
      actor: "weekly-review",
      reason: "refined after data",
      op_id: "op_003",
    });
    expect(next).toHaveLength(2);
    const old = next.find((r) => r.id === "lrn_2026-06-01_aaaa")!;
    const fresh = next.find((r) => r.id === "lrn_2026-06-08_bbbb")!;
    expect(old.status).toBe("archived");
    expect(fresh.text).toBe("Pricing is too low for mid-market");
    expect(fresh.supersedes).toBe("lrn_2026-06-01_aaaa");
    expect(fresh.kind).toBe("hypothesis");
  });
});

describe("core/state — task routing", () => {
  it("routeTask produces a Linear payload and does not return a learnings record", () => {
    const payload = routeTask({
      op: "task",
      title: "Send Acme the MSA",
      origin: "granola:m1",
      target: "linear",
    });
    expect(payload.target).toBe("linear");
    expect(payload.title).toBe("Send Acme the MSA");
    expect(payload.origin).toBe("granola:m1");
    // the payload is not a learnings record
    expect(payload).not.toHaveProperty("kind");
  });
});

describe("core/state — projections", () => {
  it("isValidStatus enforces the per-kind table", () => {
    expect(isValidStatus("learning", "promoted")).toBe(true);
    expect(isValidStatus("hypothesis", "rejected")).toBe(true);
    expect(isValidStatus("decision", "active")).toBe(true);
    expect(isValidStatus("decision", "candidate")).toBe(false);
    expect(isValidStatus("learning", "active")).toBe(false);
  });

  it("reindex recomputes counts by status, deterministically", () => {
    let recs = addRecord([], { kind: "learning", status: "promoted", text: "a", origin: "o" }, CTX);
    recs = addRecord(
      recs,
      { kind: "hypothesis", status: "candidate", text: "b", origin: "o" },
      { ...CTX, id: "lrn_x" },
    );
    const yaml = reindex(recs, [
      { name: "learning-loop", last_run: "2026-06-01T08:35:00Z", sla_hours: 26, status: "fresh" },
    ]);
    expect(yaml).toContain("schema_version: 1");
    expect(yaml).toContain("promoted: 1");
    expect(yaml).toContain("candidate: 1");
    expect(yaml).toContain("learning-loop");
    // deterministic: same input → identical output
    expect(
      reindex(recs, [
        { name: "learning-loop", last_run: "2026-06-01T08:35:00Z", sla_hours: 26, status: "fresh" },
      ]),
    ).toBe(yaml);
  });

  it("projectDecisions renders only decision records, deterministically", () => {
    let recs = addRecord(
      [],
      { kind: "decision", status: "active", text: "Adopt usage-based pricing", origin: "o" },
      CTX,
    );
    recs = addRecord(
      recs,
      { kind: "hypothesis", status: "candidate", text: "noise", origin: "o" },
      { ...CTX, id: "lrn_y" },
    );
    const md = projectDecisions(recs);
    expect(md).toContain("Adopt usage-based pricing");
    expect(md).not.toContain("noise");
    expect(projectDecisions(recs)).toBe(md);
  });
});

describe("core/state — jsonl round-trip", () => {
  it("parseJsonl(toJsonl(x)) === x and ignores blank lines", () => {
    const recs = seed();
    const text = toJsonl(recs) + "\n\n";
    expect(parseJsonl(text)).toEqual(recs);
  });
});
