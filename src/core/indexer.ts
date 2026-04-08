import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chunkDocuments } from "./chunking";
import { config } from "./config";
import { loadCorpus } from "./corpus";
import { createDefaultEmbeddingProvider } from "./embeddings";
import { tokenize } from "./tokenization";
import type { ChunkIndexEntry, IndexArtifacts } from "./types";

let indexBuildPromise: Promise<IndexArtifacts> | null = null;

export async function buildIndex(): Promise<IndexArtifacts> {
  if (indexBuildPromise) {
    return indexBuildPromise;
  }

  indexBuildPromise = (async () => {
    const documents = await loadCorpus();
    const chunks = chunkDocuments(documents);
    const embeddingProvider = createDefaultEmbeddingProvider();
    const vectors = await embeddingProvider.embed(chunks.map((chunk) => `${chunk.heading}\n${chunk.text}`));

    const documentFrequency: Record<string, number> = {};
    const entries: ChunkIndexEntry[] = chunks.map((chunk, index) => {
      const tokens = tokenize(chunk.text);
      const uniqueTokens = new Set(tokens);
      const termFrequency = Object.fromEntries(
        tokens.reduce((accumulator, token) => {
          accumulator.set(token, (accumulator.get(token) ?? 0) + 1);
          return accumulator;
        }, new Map<string, number>())
      );

      for (const token of uniqueTokens) {
        documentFrequency[token] = (documentFrequency[token] ?? 0) + 1;
      }

      return {
        chunk,
        tokens,
        termFrequency,
        vector: vectors[index] ?? []
      };
    });

    const averageChunkLength =
      entries.reduce((total, entry) => total + entry.tokens.length, 0) / Math.max(entries.length, 1);

    const artifacts: IndexArtifacts = {
      builtAt: new Date().toISOString(),
      documents,
      chunks,
      entries,
      documentFrequency,
      averageChunkLength,
      vectorDimension: config.vectorDimension
    };

    await mkdir(path.dirname(config.indexPath), { recursive: true });
    await Bun.write(config.indexPath, JSON.stringify(artifacts, null, 2));

    return artifacts;
  })();

  try {
    return await indexBuildPromise;
  } finally {
    indexBuildPromise = null;
  }
}

export async function loadIndex(): Promise<IndexArtifacts> {
  if (indexBuildPromise) {
    return indexBuildPromise;
  }

  const file = Bun.file(config.indexPath);
  if (!(await file.exists())) {
    return buildIndex();
  }

  if (await isCorpusNewerThanIndex()) {
    return buildIndex();
  }

  return (await file.json()) as IndexArtifacts;
}

async function isCorpusNewerThanIndex(): Promise<boolean> {
  const indexStats = await stat(config.indexPath);
  const corpusEntries = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: config.corpusDir, absolute: true }));

  for (const entry of corpusEntries) {
    const entryStats = await stat(entry);
    if (entryStats.mtimeMs > indexStats.mtimeMs) {
      return true;
    }
  }

  return false;
}
