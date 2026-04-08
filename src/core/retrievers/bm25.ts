import { config } from "../config";
import { tokenize } from "../tokenization";
import type { IndexArtifacts, RetrievalHit } from "../types";

export function lexicalSearch(index: IndexArtifacts, query: string, source = "bm25"): RetrievalHit[] {
  const queryTokens = tokenize(query);
  const hits: RetrievalHit[] = [];
  const documentCount = index.entries.length;

  index.entries.forEach((entry) => {
    let score = 0;

    for (const token of queryTokens) {
      const tf = entry.termFrequency[token] ?? 0;
      if (!tf) {
        continue;
      }

      const df = index.documentFrequency[token] ?? 0.5;
      const idf = Math.log(1 + (documentCount - df + 0.5) / (df + 0.5));
      const numerator = tf * (config.bm25.k1 + 1);
      const denominator =
        tf +
        config.bm25.k1 * (1 - config.bm25.b + config.bm25.b * (entry.tokens.length / index.averageChunkLength));

      score += idf * (numerator / denominator);
    }

    if (score > 0) {
      hits.push({
        chunkId: entry.chunk.id,
        score,
        source,
        rank: 0
      });
    }
  });

  return rankHits(hits);
}

function rankHits(hits: RetrievalHit[]): RetrievalHit[] {
  return hits
    .sort((left, right) => right.score - left.score)
    .slice(0, config.topKPerRetriever)
    .map((hit, index) => ({
      ...hit,
      rank: index + 1
    }));
}
