import { describe, expect, test } from "bun:test";
import { buildIndex } from "../src/core/indexer";
import { listApplicantCards, underwriteApplicant } from "../src/core/underwriting";

describe("underwriting workflow", () => {
  test("lists the seeded applicant set", async () => {
    const applicants = await listApplicantCards();

    expect(applicants.length).toBe(3);
    expect(applicants.some((applicant) => applicant.id === "atlas-growth")).toBe(true);
    expect(applicants.some((applicant) => applicant.id === "cedar-commerce")).toBe(true);
  });

  test("produces differentiated decisions for strong and weak borrowers", async () => {
    await buildIndex();

    const atlas = await underwriteApplicant("atlas-growth");
    const cedar = await underwriteApplicant("cedar-commerce");

    expect(["Approve", "Approve with reserve"]).toContain(atlas.decision.verdict);
    expect(atlas.memoSections.length).toBeGreaterThanOrEqual(4);
    expect(atlas.evidence.length).toBeGreaterThan(0);

    expect(["Manual review", "Decline"]).toContain(cedar.decision.verdict);
    expect(cedar.flags.length).toBeGreaterThan(0);
    expect(cedar.flags.some((flag) => /chargeback|negative|runway|coverage/i.test(flag.label))).toBe(true);
  });
});
