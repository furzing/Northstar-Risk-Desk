import { describe, expect, test } from "bun:test";
import { answerQuestion } from "../src/core/answerer";
import { runEvaluation } from "../src/core/evaluator";
import { buildIndex } from "../src/core/indexer";

describe("answerQuestion", () => {
  test("abstains on unsupported gibberish queries", async () => {
    await buildIndex();
    const answer = await answerQuestion("zzzz glorp frobnicator manifold quasar");

    expect(answer.answerSentences.length).toBe(0);
    expect(answer.warnings[0]).toContain("abstaining");
  });

  test("evaluation metrics stay within probabilistic bounds", async () => {
    await buildIndex();
    const report = await runEvaluation();

    expect(report.aggregate.recallAt5).toBeGreaterThanOrEqual(0);
    expect(report.aggregate.recallAt5).toBeLessThanOrEqual(1);
    expect(report.aggregate.ndcgAt10).toBeGreaterThanOrEqual(0);
    expect(report.aggregate.ndcgAt10).toBeLessThanOrEqual(1);
  });
});
