export type DocumentFormat = "markdown" | "text" | "json";

export interface SourceDocument {
  id: string;
  title: string;
  path: string;
  format: DocumentFormat;
  metadata: Record<string, string>;
  body: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  documentTitle: string;
  order: number;
  heading: string;
  text: string;
  tokenCount: number;
  metadata: Record<string, string>;
}

export interface QueryVariant {
  label: string;
  text: string;
  weight: number;
}

export interface RetrievalHit {
  chunkId: string;
  score: number;
  source: string;
  rank: number;
}

export interface Evidence {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  heading: string;
  text: string;
  score: number;
  lexicalScore: number;
  vectorScore: number;
  fusedScore: number;
}

export interface AnswerSentence {
  text: string;
  citationChunkIds: string[];
}

export interface AnswerResult {
  query: string;
  answer: string;
  answerSentences: AnswerSentence[];
  evidence: Evidence[];
  warnings: string[];
  confidence: number;
  retrievalTrace: RetrievalTrace;
}

export interface RetrievalTrace {
  variants: QueryVariant[];
  lexicalTopHits: RetrievalHit[];
  vectorTopHits: RetrievalHit[];
  fusedTopHits: RetrievalHit[];
}

export interface ChunkIndexEntry {
  chunk: Chunk;
  tokens: string[];
  termFrequency: Record<string, number>;
  vector: number[];
}

export interface IndexArtifacts {
  builtAt: string;
  documents: SourceDocument[];
  chunks: Chunk[];
  entries: ChunkIndexEntry[];
  documentFrequency: Record<string, number>;
  averageChunkLength: number;
  vectorDimension: number;
}

export interface EvaluationQuery {
  id: string;
  query: string;
  relevantDocumentIds: string[];
  expectedPhrases: string[];
}

export interface EvaluationResult {
  queryId: string;
  query: string;
  recallAt5: number;
  recallAt10: number;
  mrrAt10: number;
  ndcgAt10: number;
  supportRate: number;
}

export interface EvaluationSummary {
  generatedAt: string;
  aggregate: {
    recallAt5: number;
    recallAt10: number;
    mrrAt10: number;
    ndcgAt10: number;
    supportRate: number;
  };
  results: EvaluationResult[];
}
