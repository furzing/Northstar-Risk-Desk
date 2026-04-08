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

export type RequestedProduct = "working_capital_line" | "invoice_advance";

export type ApplicantTransactionCategory =
  | "revenue"
  | "invoice_payment"
  | "payout"
  | "payroll"
  | "rent"
  | "software"
  | "contractor"
  | "inventory"
  | "freight"
  | "marketing"
  | "tax"
  | "loan_payment"
  | "processing_fee"
  | "refund"
  | "chargeback"
  | "nsf_fee"
  | "insurance"
  | "utilities"
  | "professional_services"
  | "owner_draw";

export interface ApplicantTransaction {
  date: string;
  description: string;
  amount: number;
  category: ApplicantTransactionCategory;
  counterparty?: string;
}

export type InvoiceStatus = "paid" | "pending" | "overdue";

export interface ApplicantInvoice {
  invoiceId: string;
  customer: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  paidDate?: string;
}

export interface ApplicantObligation {
  lender: string;
  type: string;
  monthlyPayment: number;
  outstandingBalance: number;
}

export interface ApplicantProfile {
  id: string;
  businessName: string;
  industry: string;
  requestedProduct: RequestedProduct;
  requestedAmount: number;
  requestedPurpose: string;
  foundedYear: number;
  headquarters: string;
  openingBalance: number;
  narrative: string;
  policyFocus: string[];
  transactions: ApplicantTransaction[];
  invoices: ApplicantInvoice[];
  obligations: ApplicantObligation[];
}

export interface ApplicantCard {
  id: string;
  businessName: string;
  industry: string;
  requestedProduct: RequestedProduct;
  requestedAmount: number;
  headline: string;
  quickLook: string[];
}

export type InsightSeverity = "positive" | "watch" | "critical";

export interface RiskInsight {
  label: string;
  severity: InsightSeverity;
  detail: string;
}

export interface UnderwritingMetric {
  key: string;
  label: string;
  displayValue: string;
  numericValue: number;
  tone: InsightSeverity | "neutral";
  note: string;
}

export interface MemoSection {
  title: string;
  bullets: string[];
}

export interface MonthlyCashPoint {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
  endBalance: number;
}

export type UnderwritingVerdict = "Approve" | "Approve with reserve" | "Manual review" | "Decline";

export interface UnderwritingDecision {
  verdict: UnderwritingVerdict;
  riskScore: number;
  confidence: number;
  suggestedLimit: number;
  reservePercentage: number;
  rationale: string;
}

export interface TransactionHighlight {
  date: string;
  title: string;
  detail: string;
  amount: number;
  tone: "credit" | "debit" | "alert";
}

export interface UnderwritingResult {
  applicant: ApplicantProfile;
  headline: string;
  policyQuery: string;
  decision: UnderwritingDecision;
  metrics: UnderwritingMetric[];
  strengths: RiskInsight[];
  flags: RiskInsight[];
  memoSections: MemoSection[];
  monthlySeries: MonthlyCashPoint[];
  transactionHighlights: TransactionHighlight[];
  evidence: Evidence[];
  retrievalTrace: RetrievalTrace;
}
