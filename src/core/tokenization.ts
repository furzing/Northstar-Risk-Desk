import { STOPWORDS } from "./stopwords";

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string, { keepStopwords = false } = {}): string[] {
  const normalized = normalizeText(input);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map(stemToken)
    .filter(Boolean)
    .filter((token) => keepStopwords || !STOPWORDS.has(token));
}

export function splitSentences(input: string): string[] {
  return input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function countApproximateTokens(input: string): number {
  return tokenize(input, { keepStopwords: true }).length;
}

function stemToken(token: string): string {
  if (token.length <= 4) {
    return token;
  }

  return token
    .replace(/(ing|edly|edly|ed|ly|ies|s)$/u, "")
    .replace(/(tion|ment)$/u, "");
}
