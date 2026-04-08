import { describe, expect, test } from "bun:test";
import { buildIndex } from "../src/core/indexer";
import { retrieveEvidence } from "../src/core/retrieval";

describe("retrieveEvidence", () => {
  test("surfaces the merchant underwriting document for a reserve policy question", async () => {
    await buildIndex();
    const result = await retrieveEvidence("What conditions should trigger a reserve recommendation in merchant underwriting?");

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.trace.fusedTopHits.some((item) => item.chunkId.startsWith("merchant-underwriting::"))).toBe(true);
  });
});
