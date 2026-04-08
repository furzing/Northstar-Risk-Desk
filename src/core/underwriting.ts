import { getApplicant, humanizeRequestedProduct, loadApplicants } from "./applicants";
import { answerQuestion } from "./answerer";
import { average } from "./math";
import { retrieveEvidence } from "./retrieval";
import type {
  AnswerResult,
  ApplicantCard,
  ApplicantInvoice,
  ApplicantProfile,
  ApplicantTransaction,
  MonthlyCashPoint,
  RiskInsight,
  TransactionHighlight,
  UnderwritingDecision,
  UnderwritingMetric,
  UnderwritingResult,
  UnderwritingVerdict
} from "./types";

const REVENUE_CATEGORIES = new Set(["revenue", "invoice_payment", "payout"]);
const OPERATING_OUTFLOW_CATEGORIES = new Set([
  "payroll",
  "rent",
  "software",
  "contractor",
  "inventory",
  "freight",
  "marketing",
  "tax",
  "processing_fee",
  "refund",
  "insurance",
  "utilities",
  "professional_services"
]);

interface MonthlyAccumulator {
  inflow: number;
  outflow: number;
  revenue: number;
  operatingOutflow: number;
  endBalance: number;
}

interface ComputedProfile {
  monthlySeries: MonthlyCashPoint[];
  averageMonthlyInflow: number;
  averageMonthlyOutflow: number;
  averageMonthlyRevenue: number;
  averageMonthlyOperatingOutflow: number;
  averageMonthlyNet: number;
  freeCashFlowBeforeDebt: number;
  debtService: number;
  dscr: number;
  currentBalance: number;
  minimumBalance: number;
  negativeBalanceDays: number;
  runwayMonths: number;
  topCustomerConcentration: number;
  recurringRevenueShare: number;
  overdueInvoiceRatio: number;
  revenueVolatility: number;
  netCashTrend: number;
  revenueTrend: number;
  chargebackCount: number;
  chargebackRatio: number;
  nsfCount: number;
  eligibleReceivables: number;
  pendingReceivables: number;
  score: number;
  verdict: UnderwritingVerdict;
  reservePercentage: number;
  suggestedLimit: number;
  rationale: string;
  strengths: RiskInsight[];
  flags: RiskInsight[];
  confidenceBase: number;
  transactionHighlights: TransactionHighlight[];
}

export async function listApplicantCards(): Promise<ApplicantCard[]> {
  const applicants = await loadApplicants();
  return applicants.map((applicant) => {
    const computed = analyzeApplicant(applicant);
    return {
      id: applicant.id,
      businessName: applicant.businessName,
      industry: applicant.industry,
      requestedProduct: applicant.requestedProduct,
      requestedAmount: applicant.requestedAmount,
      headline: `${computed.verdict} · score ${computed.score}`,
      quickLook: [
        `DSCR ${formatMultiple(computed.dscr)}`,
        `Runway ${formatMonths(computed.runwayMonths)}`,
        `Top customer ${formatPercent(computed.topCustomerConcentration)}`
      ]
    };
  });
}

export async function underwriteApplicant(applicantId: string): Promise<UnderwritingResult> {
  const applicant = await getApplicant(applicantId);
  const computed = analyzeApplicant(applicant);
  const policyQuery = buildPolicyQuery(applicant, computed);
  const { evidence, trace } = await retrieveEvidence(policyQuery);
  const confidence = Math.min(0.95, computed.confidenceBase + estimateEvidenceLift(evidence));

  const decision: UnderwritingDecision = {
    verdict: computed.verdict,
    riskScore: computed.score,
    confidence,
    suggestedLimit: computed.suggestedLimit,
    reservePercentage: computed.reservePercentage,
    rationale: computed.rationale
  };

  return {
    applicant,
    headline: buildHeadline(applicant, decision),
    policyQuery,
    decision,
    metrics: buildMetrics(computed),
    strengths: computed.strengths,
    flags: computed.flags,
    memoSections: buildMemoSections(applicant, computed, evidence, decision),
    monthlySeries: computed.monthlySeries,
    transactionHighlights: computed.transactionHighlights,
    evidence,
    retrievalTrace: trace
  };
}

export async function answerUnderwritingQuestion(applicantId: string, query: string): Promise<AnswerResult> {
  const applicant = await getApplicant(applicantId);
  const computed = analyzeApplicant(applicant);
  const contextualQuery = `${query}. Applicant context: ${buildApplicantContext(applicant, computed)}`;
  const answer = await answerQuestion(contextualQuery);

  return {
    ...answer,
    query
  };
}

function analyzeApplicant(applicant: ApplicantProfile): ComputedProfile {
  const transactions = [...applicant.transactions].sort((left, right) => left.date.localeCompare(right.date));
  const monthlyMap = new Map<string, MonthlyAccumulator>();
  let runningBalance = applicant.openingBalance;
  let minimumBalance = runningBalance;
  let negativeBalanceDays = 0;

  for (let index = 0; index < transactions.length; index += 1) {
    const transaction = transactions[index]!;
    runningBalance += transaction.amount;
    minimumBalance = Math.min(minimumBalance, runningBalance);

    const month = transaction.date.slice(0, 7);
    const bucket = monthlyMap.get(month) ?? {
      inflow: 0,
      outflow: 0,
      revenue: 0,
      operatingOutflow: 0,
      endBalance: runningBalance
    };

    if (transaction.amount >= 0) {
      bucket.inflow += transaction.amount;
      if (REVENUE_CATEGORIES.has(transaction.category)) {
        bucket.revenue += transaction.amount;
      }
    } else {
      const absoluteAmount = Math.abs(transaction.amount);
      bucket.outflow += absoluteAmount;
      if (OPERATING_OUTFLOW_CATEGORIES.has(transaction.category)) {
        bucket.operatingOutflow += absoluteAmount;
      }
    }

    bucket.endBalance = runningBalance;
    monthlyMap.set(month, bucket);

    if (runningBalance < 0) {
      const currentDate = parseDate(transaction.date);
      const nextDate = parseDate(transactions[index + 1]?.date ?? addDays(transaction.date, 1));
      negativeBalanceDays += Math.max(1, differenceInDays(currentDate, nextDate));
    }
  }

  const monthlySeries = [...monthlyMap.entries()].map(([month, bucket]) => ({
    month,
    inflow: bucket.inflow,
    outflow: bucket.outflow,
    net: bucket.inflow - bucket.outflow,
    endBalance: bucket.endBalance
  }));

  const monthlyRevenues = monthlySeries.map((month) => month.inflow);
  const averageMonthlyInflow = average(monthlySeries.map((month) => month.inflow));
  const averageMonthlyOutflow = average(monthlySeries.map((month) => month.outflow));
  const averageMonthlyRevenue = average(monthlySeries.map((month) => month.inflow));
  const averageMonthlyOperatingOutflow = average(
    [...monthlyMap.values()].map((month) => month.operatingOutflow)
  );
  const averageMonthlyNet = average(monthlySeries.map((month) => month.net));
  const debtService = applicant.obligations.reduce((total, item) => total + item.monthlyPayment, 0);
  const freeCashFlowBeforeDebt = averageMonthlyRevenue - averageMonthlyOperatingOutflow;
  const dscr = debtService ? Math.max(freeCashFlowBeforeDebt / debtService, 0) : 9;
  const burnRate = Math.max(averageMonthlyOutflow - averageMonthlyInflow, 0);
  const runwayMonths = burnRate ? runningBalance / burnRate : 12;

  const {
    topCustomerConcentration,
    recurringRevenueShare,
    overdueInvoiceRatio,
    eligibleReceivables,
    pendingReceivables
  } = analyzeInvoices(applicant.invoices);

  const nsfCount = transactions.filter((transaction) => transaction.category === "nsf_fee").length;
  const chargebackTransactions = transactions.filter((transaction) => transaction.category === "chargeback");
  const chargebackCount = chargebackTransactions.length;
  const chargebackRatio =
    averageMonthlyRevenue > 0
      ? chargebackTransactions.reduce((total, transaction) => total + Math.abs(transaction.amount), 0) /
        (averageMonthlyRevenue * Math.max(monthlySeries.length, 1))
      : 0;
  const revenueVolatility = averageMonthlyRevenue ? standardDeviation(monthlyRevenues) / averageMonthlyRevenue : 0;
  const netCashTrend =
    monthlySeries.length > 1 ? monthlySeries[monthlySeries.length - 1]!.net - monthlySeries[0]!.net : averageMonthlyNet;
  const revenueTrend =
    monthlySeries.length > 1
      ? monthlySeries[monthlySeries.length - 1]!.inflow - monthlySeries[0]!.inflow
      : averageMonthlyRevenue;

  const score = clamp(
    44 +
      scoreBand(dscr, [
        [1.8, 18],
        [1.35, 10],
        [1.05, 2]
      ], -18) +
      scoreBand(runwayMonths, [
        [8, 12],
        [4, 6],
        [2, -4]
      ], -12) +
      inverseScoreBand(topCustomerConcentration, [
        [0.3, 10],
        [0.4, 4],
        [0.5, -6]
      ], -14) +
      scoreBand(recurringRevenueShare, [
        [0.75, 10],
        [0.55, 5],
        [0.35, 0]
      ], -8) +
      inverseScoreBand(overdueInvoiceRatio, [
        [0.05, 7],
        [0.12, 1],
        [0.2, -8]
      ], -12) +
      inverseScoreBand(revenueVolatility, [
        [0.12, 7],
        [0.22, 2],
        [0.35, -6]
      ], -10) +
      inverseScoreBand(nsfCount, [
        [0, 4],
        [1, -2],
        [2, -8]
      ], -12) +
      inverseScoreBand(chargebackCount, [
        [0, 4],
        [1, -2],
        [2, -10]
      ], -14) +
      scoreBand(netCashTrend, [
        [5000, 6],
        [0, 2],
        [-5000, -5]
      ], -8),
    0,
    100
  );

  const verdict =
    score >= 80 && dscr >= 1.5 && topCustomerConcentration < 0.42 && overdueInvoiceRatio < 0.12
      ? "Approve"
      : score >= 65 && dscr >= 1.15 && runwayMonths >= 2.5
        ? "Approve with reserve"
        : score >= 48 && dscr >= 0.9
          ? "Manual review"
          : "Decline";

  const reservePercentage =
    verdict === "Approve"
      ? topCustomerConcentration > 0.38 ? 3 : 0
      : verdict === "Approve with reserve"
        ? topCustomerConcentration > 0.42 || nsfCount > 0 || overdueInvoiceRatio > 0.1
          ? 8
          : 5
        : verdict === "Manual review"
          ? 10
          : 0;

  const suggestedLimit =
    applicant.requestedProduct === "invoice_advance"
      ? Math.round(
          Math.min(
            applicant.requestedAmount,
            eligibleReceivables * (score >= 78 ? 0.82 : score >= 62 ? 0.74 : 0.62)
          )
        )
      : Math.round(
          Math.min(
            applicant.requestedAmount,
            averageMonthlyRevenue * (score >= 78 ? 0.62 : score >= 62 ? 0.48 : 0.32)
          )
        );

  const strengths = buildStrengths({
    recurringRevenueShare,
    dscr,
    runwayMonths,
    overdueInvoiceRatio,
    topCustomerConcentration,
    revenueVolatility,
    pendingReceivables
  });
  const flags = buildFlags({
    topCustomerConcentration,
    overdueInvoiceRatio,
    nsfCount,
    chargebackCount,
    negativeBalanceDays,
    dscr,
    revenueTrend,
    runwayMonths
  });

  const rationale = buildRationale(verdict, {
    dscr,
    runwayMonths,
    topCustomerConcentration,
    overdueInvoiceRatio,
    nsfCount,
    chargebackCount
  });

  const confidenceBase = clamp(
    0.56 +
      Math.min(Math.abs(score - 60) / 100, 0.18) +
      (verdict === "Manual review" ? -0.06 : 0) +
      (flags.length ? 0 : 0.05),
    0.45,
    0.82
  );

  return {
    monthlySeries,
    averageMonthlyInflow,
    averageMonthlyOutflow,
    averageMonthlyRevenue,
    averageMonthlyOperatingOutflow,
    averageMonthlyNet,
    freeCashFlowBeforeDebt,
    debtService,
    dscr,
    currentBalance: runningBalance,
    minimumBalance,
    negativeBalanceDays,
    runwayMonths,
    topCustomerConcentration,
    recurringRevenueShare,
    overdueInvoiceRatio,
    revenueVolatility,
    netCashTrend,
    revenueTrend,
    chargebackCount,
    chargebackRatio,
    nsfCount,
    eligibleReceivables,
    pendingReceivables,
    score,
    verdict,
    reservePercentage,
    suggestedLimit: Math.max(suggestedLimit, 0),
    rationale,
    strengths,
    flags,
    confidenceBase,
    transactionHighlights: buildTransactionHighlights(transactions)
  };
}

function buildPolicyQuery(applicant: ApplicantProfile, computed: ComputedProfile): string {
  return [
    `Underwrite a ${humanizeRequestedProduct(applicant.requestedProduct)} request for ${applicant.industry}.`,
    `Requested amount ${Math.round(applicant.requestedAmount)}.`,
    `DSCR ${computed.dscr.toFixed(2)}.`,
    `Runway ${computed.runwayMonths.toFixed(1)} months.`,
    `Top customer concentration ${(computed.topCustomerConcentration * 100).toFixed(0)} percent.`,
    `Recurring revenue ${(computed.recurringRevenueShare * 100).toFixed(0)} percent.`,
    `Overdue receivables ${(computed.overdueInvoiceRatio * 100).toFixed(0)} percent.`,
    `${computed.nsfCount} NSF events and ${computed.chargebackCount} chargebacks.`,
    `Policy focus: ${applicant.policyFocus.join(", ")}.`
  ].join(" ");
}

function buildHeadline(applicant: ApplicantProfile, decision: UnderwritingDecision): string {
  const structure =
    decision.verdict === "Approve"
      ? `approve ${formatCurrency(decision.suggestedLimit)} with no reserve`
      : decision.verdict === "Approve with reserve"
        ? `approve ${formatCurrency(decision.suggestedLimit)} with a ${decision.reservePercentage}% reserve`
        : decision.verdict === "Manual review"
          ? `move to manual review with a provisional ${decision.reservePercentage}% reserve`
          : `decline the current ${formatCurrency(applicant.requestedAmount)} request`;

  return `${applicant.businessName}: ${structure}.`;
}

function buildMemoSections(
  applicant: ApplicantProfile,
  computed: ComputedProfile,
  evidence: UnderwritingResult["evidence"],
  decision: UnderwritingDecision
): UnderwritingResult["memoSections"] {
  return [
    {
      title: "Executive Summary",
      bullets: [
        `${applicant.businessName} is requesting a ${humanizeRequestedProduct(applicant.requestedProduct)} of ${formatCurrency(applicant.requestedAmount)} to ${lowercaseFirst(applicant.requestedPurpose)}`,
        `Trailing monthly inflow averages ${formatCurrency(computed.averageMonthlyInflow)} against ${formatCurrency(computed.averageMonthlyOutflow)} of outflow, producing proxy DSCR of ${formatMultiple(computed.dscr)} and ${formatMonths(computed.runwayMonths)} of runway.`,
        buildRecommendationLine(decision)
      ]
    },
    {
      title: "Cash Flow Quality",
      bullets: [
        `Recurring revenue share is ${formatPercent(computed.recurringRevenueShare)} and top customer concentration is ${formatPercent(computed.topCustomerConcentration)}.`,
        `Overdue receivables sit at ${formatPercent(computed.overdueInvoiceRatio)} of invoice volume, while revenue volatility is ${formatPercent(computed.revenueVolatility)}.`,
        `Current cash balance is ${formatCurrency(computed.currentBalance)} with a minimum observed balance of ${formatCurrency(computed.minimumBalance)}.`
      ]
    },
    {
      title: "Risk Signals",
      bullets:
        computed.flags.length > 0
          ? computed.flags.map((flag) => `${flag.label}: ${flag.detail}`)
          : ["No material deterioration flags breached the current policy thresholds."]
    },
    {
      title: "Policy Alignment",
      bullets:
        evidence.length > 0
          ? evidence.slice(0, 3).map((item) => `${collapseEvidence(item.text)} [${item.documentTitle} / ${item.heading}]`)
          : ["The retrieval layer did not return enough policy support to anchor a stronger narrative."]
    },
    {
      title: "Monitoring Plan",
      bullets: buildMonitoringBullets(decision.verdict, computed)
    }
  ];
}

function buildMetrics(computed: ComputedProfile): UnderwritingMetric[] {
  return [
    {
      key: "risk-score",
      label: "Risk score",
      displayValue: String(computed.score),
      numericValue: computed.score,
      tone: computed.score >= 80 ? "positive" : computed.score >= 62 ? "watch" : "critical",
      note: "Composite score from liquidity, debt coverage, concentration, volatility, and bank-statement events."
    },
    {
      key: "dscr",
      label: "DSCR",
      displayValue: formatMultiple(computed.dscr),
      numericValue: computed.dscr,
      tone: computed.dscr >= 1.5 ? "positive" : computed.dscr >= 1.1 ? "watch" : "critical",
      note: "Proxy debt-service coverage using average revenue minus operating outflow before debt."
    },
    {
      key: "runway",
      label: "Runway",
      displayValue: formatMonths(computed.runwayMonths),
      numericValue: computed.runwayMonths,
      tone: computed.runwayMonths >= 6 ? "positive" : computed.runwayMonths >= 3 ? "watch" : "critical",
      note: "Months of coverage if current outflow exceeds inflow."
    },
    {
      key: "concentration",
      label: "Top customer",
      displayValue: formatPercent(computed.topCustomerConcentration),
      numericValue: computed.topCustomerConcentration,
      tone: computed.topCustomerConcentration <= 0.3 ? "positive" : computed.topCustomerConcentration <= 0.45 ? "watch" : "critical",
      note: "Largest obligor share of recent invoice volume."
    },
    {
      key: "recurring",
      label: "Recurring revenue",
      displayValue: formatPercent(computed.recurringRevenueShare),
      numericValue: computed.recurringRevenueShare,
      tone: computed.recurringRevenueShare >= 0.7 ? "positive" : computed.recurringRevenueShare >= 0.5 ? "watch" : "critical",
      note: "Revenue from customers appearing in more than one monthly cycle."
    },
    {
      key: "aging",
      label: "Overdue A/R",
      displayValue: formatPercent(computed.overdueInvoiceRatio),
      numericValue: computed.overdueInvoiceRatio,
      tone: computed.overdueInvoiceRatio <= 0.08 ? "positive" : computed.overdueInvoiceRatio <= 0.16 ? "watch" : "critical",
      note: "Overdue invoice share of the current receivables book."
    }
  ];
}

function buildStrengths(input: {
  recurringRevenueShare: number;
  dscr: number;
  runwayMonths: number;
  overdueInvoiceRatio: number;
  topCustomerConcentration: number;
  revenueVolatility: number;
  pendingReceivables: number;
}): RiskInsight[] {
  const strengths: RiskInsight[] = [];

  if (input.recurringRevenueShare >= 0.7) {
    strengths.push({
      label: "Recurring revenue base",
      severity: "positive",
      detail: `A repeat-customer mix of ${formatPercent(input.recurringRevenueShare)} supports forward visibility.`
    });
  }

  if (input.dscr >= 1.5) {
    strengths.push({
      label: "Comfortable debt coverage",
      severity: "positive",
      detail: `Debt coverage of ${formatMultiple(input.dscr)} leaves room for modest downside.`
    });
  }

  if (input.runwayMonths >= 6) {
    strengths.push({
      label: "Healthy liquidity cushion",
      severity: "positive",
      detail: `Liquidity covers roughly ${formatMonths(input.runwayMonths)} without relying on external capital.`
    });
  }

  if (input.overdueInvoiceRatio <= 0.08 && input.pendingReceivables > 0) {
    strengths.push({
      label: "Clean receivables aging",
      severity: "positive",
      detail: `Most receivables remain current, which supports higher advance confidence.`
    });
  }

  if (input.topCustomerConcentration <= 0.35 && input.revenueVolatility <= 0.18) {
    strengths.push({
      label: "Diversified revenue mix",
      severity: "positive",
      detail: "No single customer dominates cash generation and monthly inflow variability is contained."
    });
  }

  return strengths;
}

function buildFlags(input: {
  topCustomerConcentration: number;
  overdueInvoiceRatio: number;
  nsfCount: number;
  chargebackCount: number;
  negativeBalanceDays: number;
  dscr: number;
  revenueTrend: number;
  runwayMonths: number;
}): RiskInsight[] {
  const flags: RiskInsight[] = [];

  if (input.topCustomerConcentration > 0.45) {
    flags.push({
      label: "Customer concentration",
      severity: "critical",
      detail: `Top customer share of ${formatPercent(input.topCustomerConcentration)} breaches the stronger diversification band.`
    });
  } else if (input.topCustomerConcentration > 0.35) {
    flags.push({
      label: "Moderate obligor concentration",
      severity: "watch",
      detail: `Top customer share of ${formatPercent(input.topCustomerConcentration)} justifies tighter structure.`
    });
  }

  if (input.overdueInvoiceRatio > 0.15) {
    flags.push({
      label: "Receivables aging pressure",
      severity: "critical",
      detail: `${formatPercent(input.overdueInvoiceRatio)} of invoices are overdue, which points to slower collections.`
    });
  } else if (input.overdueInvoiceRatio > 0.08) {
    flags.push({
      label: "Receivables watchlist",
      severity: "watch",
      detail: `Aging has moved above the clean-book target at ${formatPercent(input.overdueInvoiceRatio)}.`
    });
  }

  if (input.nsfCount >= 2) {
    flags.push({
      label: "Repeated NSF events",
      severity: "critical",
      detail: `${input.nsfCount} returned-payment fees indicate weak payment discipline.`
    });
  } else if (input.nsfCount === 1) {
    flags.push({
      label: "Single NSF event",
      severity: "watch",
      detail: "One returned-payment event does not drive a decline alone but it supports extra monitoring."
    });
  }

  if (input.chargebackCount >= 2) {
    flags.push({
      label: "Chargeback pressure",
      severity: "critical",
      detail: `${input.chargebackCount} chargeback settlements over the quarter point to fulfillment or fraud stress.`
    });
  }

  if (input.negativeBalanceDays >= 3) {
    flags.push({
      label: "Negative balance observations",
      severity: "critical",
      detail: `The running balance dipped below zero for roughly ${input.negativeBalanceDays} days across the quarter.`
    });
  }

  if (input.dscr < 1) {
    flags.push({
      label: "Sub-1.0x debt coverage",
      severity: "critical",
      detail: `Proxy DSCR of ${formatMultiple(input.dscr)} implies the business is not covering debt comfortably from operating cash flow.`
    });
  }

  if (input.revenueTrend < -8000) {
    flags.push({
      label: "Revenue deceleration",
      severity: "watch",
      detail: "The latest month trails the quarter opening pace, which weakens confidence in near-term repayment capacity."
    });
  }

  if (input.runwayMonths < 2) {
    flags.push({
      label: "Thin liquidity runway",
      severity: "critical",
      detail: `Estimated runway of ${formatMonths(input.runwayMonths)} leaves little room for a demand shock.`
    });
  }

  return flags;
}

function buildRationale(
  verdict: UnderwritingVerdict,
  input: {
    dscr: number;
    runwayMonths: number;
    topCustomerConcentration: number;
    overdueInvoiceRatio: number;
    nsfCount: number;
    chargebackCount: number;
  }
): string {
  if (verdict === "Approve") {
    return `Cash generation is comfortably above debt service, liquidity is healthy, and the receivables book stays inside the cleaner aging bands.`;
  }

  if (verdict === "Approve with reserve") {
    return `Core cash flow supports the request, but concentration, isolated bank-statement noise, or aging drift justify structural protection.`;
  }

  if (verdict === "Manual review") {
    return `The file shows some repayment capacity, but concentration, liquidity, or collections need analyst intervention before terms are set.`;
  }

  return `The profile combines weak debt coverage, thin liquidity, or repeated statement deterioration in a way that the current request should not absorb.`;
}

function buildMonitoringBullets(verdict: UnderwritingVerdict, computed: ComputedProfile): string[] {
  const bullets = [
    `Track DSCR monthly and escalate if it falls below ${verdict === "Approve" ? "1.20x" : "1.10x"}.`,
    `Watch overdue receivables and move the account to analyst review if aging exceeds 15% of invoice volume.`,
    `Trigger an immediate review on 2 or more NSF or return events in any rolling 90-day window.`
  ];

  if (computed.topCustomerConcentration > 0.35) {
    bullets.push("Require customer concentration reporting until the largest obligor falls below 35% of invoice volume.");
  }

  if (computed.chargebackCount > 0) {
    bullets.push("Monitor refund and chargeback ratios weekly until the trend normalizes.");
  }

  return bullets;
}

function buildTransactionHighlights(transactions: ApplicantTransaction[]): TransactionHighlight[] {
  const alerts = transactions.filter(
    (transaction) => transaction.category === "nsf_fee" || transaction.category === "chargeback"
  );
  const largeMovements = transactions
    .filter((transaction) => Math.abs(transaction.amount) >= 30000 && !alerts.includes(transaction))
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));
  const notable = [...alerts, ...largeMovements].slice(0, 6);

  return notable.map((transaction) => ({
    date: transaction.date,
    title: transaction.description,
    detail: transaction.counterparty ? `Counterparty: ${transaction.counterparty}` : labelForCategory(transaction.category),
    amount: transaction.amount,
    tone:
      transaction.category === "nsf_fee" || transaction.category === "chargeback"
        ? "alert"
        : transaction.amount >= 0
          ? "credit"
          : "debit"
  }));
}

function analyzeInvoices(invoices: ApplicantInvoice[]): {
  topCustomerConcentration: number;
  recurringRevenueShare: number;
  overdueInvoiceRatio: number;
  eligibleReceivables: number;
  pendingReceivables: number;
} {
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueAmount = invoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const pendingReceivables = invoices
    .filter((invoice) => invoice.status === "pending")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const byCustomer = invoices.reduce((accumulator, invoice) => {
    accumulator.set(invoice.customer, (accumulator.get(invoice.customer) ?? 0) + invoice.amount);
    return accumulator;
  }, new Map<string, number>());

  const topCustomerConcentration = total
    ? Math.max(...[...byCustomer.values(), 0]) / total
    : 0;

  const recurringCustomers = new Set(
    [...byCustomer.entries()].filter(([, amount]) => amount > 0).map(([customer]) => customer)
  );
  const recurringRevenueShare = total
    ? invoices
        .filter((invoice) => invoices.filter((candidate) => candidate.customer === invoice.customer).length > 1)
        .reduce((sum, invoice) => sum + invoice.amount, 0) / total
    : 0;
  const eligibleReceivables = invoices
    .filter((invoice) => invoice.status !== "overdue" && differenceInDays(parseDate(invoice.issueDate), parseDate(invoice.dueDate)) <= 60)
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  return {
    topCustomerConcentration,
    recurringRevenueShare: recurringCustomers.size ? recurringRevenueShare : 0,
    overdueInvoiceRatio: total ? overdueAmount / total : 0,
    eligibleReceivables,
    pendingReceivables
  };
}

function buildApplicantContext(applicant: ApplicantProfile, computed: ComputedProfile): string {
  return [
    `${applicant.businessName} is a ${applicant.industry} business based in ${applicant.headquarters}.`,
    `The company is requesting a ${humanizeRequestedProduct(applicant.requestedProduct)} of ${formatCurrency(applicant.requestedAmount)}.`,
    `Score ${computed.score}, decision ${computed.verdict}, DSCR ${computed.dscr.toFixed(2)}, runway ${computed.runwayMonths.toFixed(1)} months.`,
    `Top customer concentration ${(computed.topCustomerConcentration * 100).toFixed(0)}%, recurring revenue ${(computed.recurringRevenueShare * 100).toFixed(0)}%, overdue invoices ${(computed.overdueInvoiceRatio * 100).toFixed(0)}%.`,
    `${computed.nsfCount} NSF events, ${computed.chargebackCount} chargebacks, ${computed.negativeBalanceDays} negative-balance days.`,
    `Focus areas: ${applicant.policyFocus.join(", ")}.`
  ].join(" ");
}

function buildRecommendationLine(decision: UnderwritingDecision): string {
  if (decision.verdict === "Decline") {
    return `Recommendation: decline the current request. Modeled support only reaches ${formatCurrency(decision.suggestedLimit)} and does not justify the requested structure.`;
  }

  if (decision.verdict === "Manual review") {
    return `Recommendation: move to manual review with a provisional structure around ${formatCurrency(decision.suggestedLimit)}${decision.reservePercentage ? ` and a ${decision.reservePercentage}% reserve` : ""}.`;
  }

  return `Recommendation: ${decision.verdict} at ${formatCurrency(decision.suggestedLimit)}${decision.reservePercentage ? ` with a ${decision.reservePercentage}% reserve` : ""}.`;
}

function estimateEvidenceLift(evidence: UnderwritingResult["evidence"]): number {
  if (!evidence.length) {
    return 0;
  }

  return clamp(average(evidence.slice(0, 3).map((item) => item.fusedScore)) * 0.34, 0.02, 0.13);
}

function collapseEvidence(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return sentence.replace(/\s+/g, " ").trim();
}

function scoreBand(
  value: number,
  thresholds: Array<[number, number]>,
  fallback: number
): number {
  for (const [threshold, score] of thresholds) {
    if (value >= threshold) {
      return score;
    }
  }
  return fallback;
}

function inverseScoreBand(
  value: number,
  thresholds: Array<[number, number]>,
  fallback: number
): number {
  for (const [threshold, score] of thresholds) {
    if (value <= threshold) {
      return score;
    }
  }
  return fallback;
}

function standardDeviation(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function differenceInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatMonths(value: number): string {
  return `${value.toFixed(1)} mo`;
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function labelForCategory(category: ApplicantTransaction["category"]): string {
  return category.replaceAll("_", " ");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
