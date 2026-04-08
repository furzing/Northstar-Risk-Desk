import { config } from "./config";
import { average } from "./math";
import { retrieveEvidence } from "./retrieval";
import { splitSentences, tokenize } from "./tokenization";
import { getOptionalLlmProvider } from "./llm";
import type { AnswerResult, Evidence } from "./types";

export async function answerQuestion(query: string): Promise<AnswerResult> {
  const { evidence, trace } = await retrieveEvidence(query);
  const confidence = estimateConfidence(evidence);
  const warnings: string[] = [];

  if (!evidence.length || confidence < config.evidenceThreshold) {
    warnings.push("Evidence strength is low. The system is abstaining instead of synthesizing a speculative answer.");
    return {
      query,
      answer:
        "I could not ground a reliable answer in the indexed corpus. Try narrowing the question, adding more domain-specific documents, or enabling a stronger embedding model.",
      answerSentences: [],
      evidence,
      warnings,
      confidence,
      retrievalTrace: trace
    };
  }

  const llmProvider = getOptionalLlmProvider();
  const answerSentences = buildExtractiveAnswer(query, evidence);
  let answer = answerSentences.map((sentence) => sentence.text).join(" ");

  if (llmProvider) {
    try {
      const generated = await llmProvider.generateGroundedAnswer(query, evidence);
      if (generated) {
        answer = generated;
      }
    } catch (error) {
      warnings.push(`Optional LLM synthesis failed: ${String(error)}`);
    }
  }

  if (!answerSentences.length) {
    warnings.push("No high-quality extractive sentence passed the grounding filter. Returning a compact evidence summary.");
    answer = summarizeEvidence(evidence);
  }

  return {
    query,
    answer,
    answerSentences,
    evidence,
    warnings,
    confidence,
    retrievalTrace: trace
  };
}

function buildExtractiveAnswer(query: string, evidence: Evidence[]) {
  const queryTokens = new Set(tokenize(query));
  const compareIntent = /\b(compare|difference|versus|vs)\b/i.test(query);
  const candidates = evidence.flatMap((item) =>
    splitSentences(item.text).map((sentence) => ({
      sentence,
      chunkId: item.chunkId,
      documentId: item.documentId,
      documentTitle: item.documentTitle,
      heading: item.heading,
      score: scoreSentence(query, sentence, queryTokens, item)
    }))
  );

  const ranked = candidates.filter((candidate) => candidate.score > 0.1).sort((left, right) => right.score - left.score);
  const selected: typeof ranked = [];
  const seenDocuments = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= 3) {
      break;
    }

    if (compareIntent && !seenDocuments.has(candidate.documentId)) {
      selected.push(candidate);
      seenDocuments.add(candidate.documentId);
      continue;
    }

    if (!compareIntent || selected.length >= 2 || !seenDocuments.has(candidate.documentId)) {
      selected.push(candidate);
      seenDocuments.add(candidate.documentId);
    }
  }

  return selected.map((candidate) => ({
    text: `${candidate.sentence} [${candidate.documentTitle} / ${candidate.heading}]`,
    citationChunkIds: [candidate.chunkId]
  }));
}

function scoreSentence(query: string, sentence: string, queryTokens: Set<string>, evidence: Evidence): number {
  const tokens = tokenize(sentence);
  if (!tokens.length) {
    return 0;
  }

  const overlapCount = tokens.filter((token) => queryTokens.has(token)).length;
  const overlapRatio = overlapCount / Math.max(queryTokens.size, 1);
  const density = Math.min(tokens.length / 42, 1);
  const headingPrior = computeHeadingPrior(query, evidence.heading);

  return overlapRatio * 0.55 + evidence.fusedScore * 2.4 + density * 0.15 + headingPrior;
}

function estimateConfidence(evidence: Evidence[]): number {
  if (!evidence.length) {
    return 0;
  }

  const topSlice = evidence.slice(0, 4);
  return Math.min(1, average(topSlice.map((item) => item.fusedScore)) * 9);
}

function summarizeEvidence(evidence: Evidence[]): string {
  return evidence
    .slice(0, 3)
    .map((item) => `${item.documentTitle} argues in "${item.heading}" that ${collapseSentence(item.text)}.`)
    .join(" ");
}

function collapseSentence(text: string): string {
  const sentence = splitSentences(text)[0] ?? text;
  return sentence.replace(/\s+/g, " ").trim();
}

function computeHeadingPrior(query: string, heading: string): number {
  const normalizedHeading = heading.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let score = 0;

  if (normalizedHeading === "thesis") {
    score -= 0.05;
  }

  if (
    /\b(how|why|compare|difference|versus|vs|improve|evaluate|respond|monitor|trigger|escalate|change)\b/.test(
      normalizedQuery
    ) &&
    /(comparison|benefit|cost|risk|action|metric|evaluation|construction|trigger|threshold|response|monitor|policy change|difference|why|when|watchlist|decision band|approval|manual review|reserve|advance rate|decline)/.test(
      normalizedHeading
    )
  ) {
    score += 0.16;
  }

  return score;
}
