import { describe, expect, test } from "bun:test";
import { buildIndex } from "../src/core/indexer";
import { retrieveEvidence } from "../src/core/retrieval";

describe("retrieveEvidence", () => {
  test("surfaces the merchant underwriting document for a reserve policy question", async () => {
    await buildIndex();
    const result = await retrieveEvidence("What conditions trigger a rolling reserve increase for a merchant?");

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]?.documentId).toBe("merchant-underwriting");
  });
});
