import path from "node:path";

const rootDir = process.cwd();

export const config = {
  rootDir,
  corpusDir: path.join(rootDir, "data", "corpus"),
  evaluationPath: path.join(rootDir, "data", "evaluation", "queries.json"),
  indexPath: path.join(rootDir, "storage", "index", "atlas-index.json"),
  publicDir: path.join(rootDir, "public"),
  serverPort: Number(process.env.PORT ?? 3000),
  chunkSize: 220,
  chunkOverlap: 40,
  topKPerRetriever: 10,
  finalEvidenceCount: 6,
  vectorDimension: 768,
  bm25: {
    k1: 1.4,
    b: 0.72
  },
  mmrLambda: 0.72,
  evidenceThreshold: 0.18
} as const;
