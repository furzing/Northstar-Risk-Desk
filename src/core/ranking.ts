import { config } from "./config";
import { cosineSimilarity } from "./math";
import type { ChunkIndexEntry, Evidence, RetrievalHit } from "./types";

export function fuseHits(hitGroups: Array<{ hits: RetrievalHit[]; weight: number }>): Map<string, number> {
  const fused = new Map<string, number>();

  for (const group of hitGroups) {
    for (const hit of group.hits) {
      const contribution = group.weight / (60 + hit.rank);
      fused.set(hit.chunkId, (fused.get(hit.chunkId) ?? 0) + contribution);
    }
  }

  return fused;
}

export function selectDiverseEvidence(
  entriesById: Map<string, ChunkIndexEntry>,
  fused: Map<string, number>,
  lexicalScores: Map<string, number>,
  vectorScores: Map<string, number>
): Evidence[] {
  const candidateIds = [...fused.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 24)
    .map(([chunkId]) => chunkId);

  const selected: string[] = [];

  while (selected.length < config.finalEvidenceCount && selected.length < candidateIds.length) {
    let bestCandidate: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const candidateId of candidateIds) {
      if (selected.includes(candidateId)) {
        continue;
      }

      const candidateEntry = entriesById.get(candidateId);
      if (!candidateEntry) {
        continue;
      }

      const relevance = fused.get(candidateId) ?? 0;
      const diversityPenalty = selected.length
        ? Math.max(
            ...selected.map((selectedId) =>
              cosineSimilarity(candidateEntry.vector, entriesById.get(selectedId)?.vector ?? [])
            )
          )
        : 0;

      const mmrScore = config.mmrLambda * relevance - (1 - config.mmrLambda) * diversityPenalty;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestCandidate = candidateId;
      }
    }

    if (!bestCandidate) {
      break;
    }

    selected.push(bestCandidate);
  }

  return selected
    .map((chunkId) => {
      const entry = entriesById.get(chunkId);
      if (!entry) {
        return null;
      }

      return {
        chunkId,
        documentId: entry.chunk.documentId,
        documentTitle: entry.chunk.documentTitle,
        heading: entry.chunk.heading,
        text: entry.chunk.text,
        score: fused.get(chunkId) ?? 0,
        lexicalScore: lexicalScores.get(chunkId) ?? 0,
        vectorScore: vectorScores.get(chunkId) ?? 0,
        fusedScore: fused.get(chunkId) ?? 0
      } satisfies Evidence;
    })
    .filter((evidence): evidence is Evidence => Boolean(evidence))
    .sort((left, right) => right.score - left.score);
}
