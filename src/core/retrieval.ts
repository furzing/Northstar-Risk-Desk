import { config } from "./config";
import { loadIndex } from "./indexer";
import { planQueryVariants } from "./query-planner";
import { fuseHits, selectDiverseEvidence } from "./ranking";
import { lexicalSearch } from "./retrievers/bm25";
import { vectorSearch } from "./retrievers/vector";
import type { AnswerResult, Evidence, RetrievalHit } from "./types";

export async function retrieveEvidence(query: string): Promise<{
  evidence: Evidence[];
  trace: AnswerResult["retrievalTrace"];
}> {
  const index = await loadIndex();
  const variants = planQueryVariants(query);

  const lexicalHits: RetrievalHit[] = [];
  const vectorHits: RetrievalHit[] = [];
  const lexicalByChunk = new Map<string, number>();
  const vectorByChunk = new Map<string, number>();
  const hitGroups: Array<{ hits: RetrievalHit[]; weight: number }> = [];

  for (const variant of variants) {
    const lexical = lexicalSearch(index, variant.text, `bm25:${variant.label}`);
    lexicalHits.push(...lexical);
    hitGroups.push({ hits: lexical, weight: variant.weight });
    for (const hit of lexical) {
      lexicalByChunk.set(hit.chunkId, Math.max(lexicalByChunk.get(hit.chunkId) ?? 0, hit.score * variant.weight));
    }

    const vector = await vectorSearch(index, variant.text, `vector:${variant.label}`);
    vectorHits.push(...vector);
    hitGroups.push({ hits: vector, weight: variant.weight * 0.92 });
    for (const hit of vector) {
      vectorByChunk.set(hit.chunkId, Math.max(vectorByChunk.get(hit.chunkId) ?? 0, hit.score * variant.weight));
    }
  }

  const fused = fuseHits(hitGroups);
  const entriesById = new Map(index.entries.map((entry) => [entry.chunk.id, entry]));
  const evidence = selectDiverseEvidence(entriesById, fused, lexicalByChunk, vectorByChunk);

  return {
    evidence,
    trace: {
      variants,
      lexicalTopHits: rankUniqueHits(lexicalHits).slice(0, config.topKPerRetriever),
      vectorTopHits: rankUniqueHits(vectorHits).slice(0, config.topKPerRetriever),
      fusedTopHits: [...fused.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, config.topKPerRetriever)
        .map(([chunkId, score], indexPosition) => ({
          chunkId,
          score,
          source: "rrf",
          rank: indexPosition + 1
        }))
    }
  };
}

function rankUniqueHits(hits: RetrievalHit[]): RetrievalHit[] {
  const strongest = new Map<string, RetrievalHit>();

  for (const hit of hits) {
    const previous = strongest.get(hit.chunkId);
    if (!previous || hit.score > previous.score) {
      strongest.set(hit.chunkId, hit);
    }
  }

  return [...strongest.values()]
    .sort((left, right) => right.score - left.score)
    .map((hit, index) => ({
      ...hit,
      rank: index + 1
    }));
}
