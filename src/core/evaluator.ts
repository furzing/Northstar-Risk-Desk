import { answerQuestion } from "./answerer";
import { config } from "./config";
import type { EvaluationQuery, EvaluationResult, EvaluationSummary } from "./types";

export async function runEvaluation(): Promise<EvaluationSummary> {
  const queries = (await Bun.file(config.evaluationPath).json()) as EvaluationQuery[];
  const results: EvaluationResult[] = [];

  for (const query of queries) {
    const answer = await answerQuestion(query.query);
    const retrievedDocumentIds = unique(answer.evidence.map((item) => item.documentId));
    const relevant = new Set(query.relevantDocumentIds);
    const expectedPhrases = query.expectedPhrases.map((phrase) => phrase.toLowerCase());

    const recallAt5 = computeRecall(retrievedDocumentIds.slice(0, 5), relevant);
    const recallAt10 = computeRecall(retrievedDocumentIds.slice(0, 10), relevant);
    const mrrAt10 = computeMrr(retrievedDocumentIds.slice(0, 10), relevant);
    const ndcgAt10 = computeNdcg(retrievedDocumentIds.slice(0, 10), relevant);
    const supportRate = computeSupportRate(answer.answer, expectedPhrases);

    results.push({
      queryId: query.id,
      query: query.query,
      recallAt5,
      recallAt10,
      mrrAt10,
      ndcgAt10,
      supportRate
    });
  }

  const aggregate = {
    recallAt5: average(results.map((result) => result.recallAt5)),
    recallAt10: average(results.map((result) => result.recallAt10)),
    mrrAt10: average(results.map((result) => result.mrrAt10)),
    ndcgAt10: average(results.map((result) => result.ndcgAt10)),
    supportRate: average(results.map((result) => result.supportRate))
  };

  return {
    generatedAt: new Date().toISOString(),
    aggregate,
    results
  };
}

function computeRecall(retrievedDocumentIds: string[], relevant: Set<string>): number {
  if (!relevant.size) {
    return 0;
  }

  const hits = new Set(retrievedDocumentIds.filter((documentId) => relevant.has(documentId)));
  return hits.size / relevant.size;
}

function computeMrr(retrievedDocumentIds: string[], relevant: Set<string>): number {
  const firstRelevantIndex = retrievedDocumentIds.findIndex((documentId) => relevant.has(documentId));
  if (firstRelevantIndex === -1) {
    return 0;
  }
  return 1 / (firstRelevantIndex + 1);
}

function computeNdcg(retrievedDocumentIds: string[], relevant: Set<string>): number {
  const dcg = retrievedDocumentIds.reduce((total, documentId, index) => {
    const gain = relevant.has(documentId) ? 1 : 0;
    return total + gain / Math.log2(index + 2);
  }, 0);

  const idealLength = Math.min(relevant.size, retrievedDocumentIds.length);
  const idcg = Array.from({ length: idealLength }).reduce((total, _, index) => total + 1 / Math.log2(index + 2), 0);

  if (!idcg) {
    return 0;
  }

  return dcg / idcg;
}

function computeSupportRate(answer: string, expectedPhrases: string[]): number {
  if (!expectedPhrases.length) {
    return 0;
  }

  const normalizedAnswer = answer.toLowerCase();
  const matches = expectedPhrases.filter((phrase) => normalizedAnswer.includes(phrase)).length;
  return matches / expectedPhrases.length;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
