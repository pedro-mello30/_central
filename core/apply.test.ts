import { describe, expect, it } from "vitest";
import { applyProposals, type Proposal, type TransitionCtx } from "./state.js";

function mkCtx(seq: number): TransitionCtx {
  return {
    id: `lrn_2026-06-01_${String(seq).padStart(4, "0")}`,
    now: "2026-06-01T08:40:00Z",
    actor: "learning-loop",
    reason: "from run",
    op_id: `op_${String(seq).padStart(3, "0")}`,
  };
}

describe("core/state — applyProposals", () => {
  it("applies add proposals into records and routes task proposals to Linear, never to JSONL", () => {
    const proposals: Proposal[] = [
      {
        op: "add",
        record: {
          kind: "learning",
          status: "candidate",
          text: "ICP skews technical",
          origin: "granola:m1",
        },
      },
      { op: "task", title: "Email Acme the MSA", origin: "granola:m1", target: "linear" },
    ];
    const res = applyProposals([], proposals, mkCtx);

    expect(res.records).toHaveLength(1);
    expect(res.records[0]!.text).toBe("ICP skews technical");
    expect(res.tasks).toHaveLength(1);
    expect(res.tasks[0]!.title).toBe("Email Acme the MSA");
    // the task never becomes a learnings record
    expect(res.records.some((r) => r.text.includes("Acme"))).toBe(false);
  });

  it("applies transition and correct proposals in order", () => {
    const seeded = applyProposals(
      [],
      [
        {
          op: "add",
          record: {
            kind: "hypothesis",
            status: "candidate",
            text: "Churn is onboarding",
            origin: "o",
          },
        },
      ],
      mkCtx,
    ).records;

    const res = applyProposals(
      seeded,
      [{ op: "transition", id: "lrn_2026-06-01_0000", to: "promoted", reason: "confirmed" }],
      mkCtx,
    );
    expect(res.records[0]!.status).toBe("promoted");
  });

  it("refuses an invalid proposal (bad status for kind) by throwing", () => {
    expect(() =>
      applyProposals(
        [],
        [{ op: "add", record: { kind: "decision", status: "candidate", text: "x", origin: "o" } }],
        mkCtx,
      ),
    ).toThrow(/decision/);
  });
});
