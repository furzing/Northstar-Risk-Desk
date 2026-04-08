import { config } from "./config";
import { normalizeVector } from "./math";
import { tokenize } from "./tokenization";

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hash-subword";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => embedHashedText(text, config.vectorDimension));
  }
}

export function createDefaultEmbeddingProvider(): EmbeddingProvider {
  return new HashEmbeddingProvider();
}

export function embedHashedText(text: string, dimension: number): number[] {
  const vector = new Array<number>(dimension).fill(0);
  const tokens = tokenize(text, { keepStopwords: true });
  const grams = buildShingles(tokens);

  for (const gram of grams) {
    const hash = fnv1a(gram);
    const slot = Math.abs(hash) % dimension;
    const sign = hash % 2 === 0 ? 1 : -1;
    const weight = gram.includes(" ") ? 1.4 : gram.length > 6 ? 1.2 : 1;
    vector[slot] = (vector[slot] ?? 0) + sign * weight;
  }

  return normalizeVector(vector);
}

function buildShingles(tokens: string[]): string[] {
  const shingles = [...tokens];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    shingles.push(`${tokens[index]} ${tokens[index + 1]}`);
  }

  for (let index = 0; index < tokens.length - 2; index += 1) {
    shingles.push(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }

  return shingles;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
