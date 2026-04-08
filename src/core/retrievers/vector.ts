import { config } from "../config";
import { cosineSimilarity } from "../math";
import { createDefaultEmbeddingProvider } from "../embeddings";
import type { IndexArtifacts, RetrievalHit } from "../types";

export async function vectorSearch(index: IndexArtifacts, query: string, source = "hashed-vector"): Promise<RetrievalHit[]> {
  const provider = createDefaultEmbeddingProvider();
  const [queryVector] = await provider.embed([query]);

  const hits: RetrievalHit[] = index.entries
    .map((entry) => ({
      chunkId: entry.chunk.id,
      score: cosineSimilarity(queryVector ?? [], entry.vector),
      source,
      rank: 0
    }))
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, config.topKPerRetriever)
    .map((hit, indexPosition) => ({
      ...hit,
      rank: indexPosition + 1
    }));

  return hits;
}
