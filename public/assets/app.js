const statusBuiltAt = document.getElementById("status-built-at");
const statusDocuments = document.getElementById("status-documents");
const statusChunks = document.getElementById("status-chunks");
const applicantList = document.getElementById("applicant-list");
const analyzeButton = document.getElementById("analyze-button");
const rebuildButton = document.getElementById("rebuild-button");
const askForm = document.getElementById("ask-form");
const queryInput = document.getElementById("query-input");
const queryMeta = document.getElementById("query-meta");
const answerBody = document.getElementById("answer-body");
const warningList = document.getElementById("warning-list");
const decisionBadge = document.getElementById("decision-badge");
const confidenceBadge = document.getElementById("confidence-badge");
const underwritingHeadline = document.getElementById("underwriting-headline");
const policyQuery = document.getElementById("policy-query");
const memoSections = document.getElementById("memo-sections");
const metricsGrid = document.getElementById("metrics-grid");
const strengthsList = document.getElementById("strengths-list");
const flagsList = document.getElementById("flags-list");
const trendBody = document.getElementById("trend-body");
const transactionBody = document.getElementById("transaction-body");
const evidenceList = document.getElementById("evidence-list");
const traceBody = document.getElementById("trace-body");
const documentList = document.getElementById("document-list");
const evaluationBody = document.getElementById("evaluation-body");
const evalButton = document.getElementById("eval-button");
const promptChips = document.getElementById("prompt-chips");

const state = {
  applicants: [],
  selectedApplicantId: null,
  analysis: null
};

async function refreshStatus() {
  const response = await fetch("/api/status");
  const status = await response.json();
  statusBuiltAt.textContent = new Date(status.builtAt).toLocaleString();
  statusDocuments.textContent = String(status.documents);
  statusChunks.textContent = String(status.chunks);
}

async function loadApplicants() {
  const response = await fetch("/api/applicants");
  state.applicants = await response.json();
  if (!state.selectedApplicantId && state.applicants.length) {
    state.selectedApplicantId = state.applicants[0].id;
  }
  renderApplicants();
}

async function loadDocuments() {
  const response = await fetch("/api/documents");
  const documents = await response.json();
  documentList.innerHTML = documents
    .map(
      (document) => `
        <article class="doc-card">
          <div class="doc-card-top">
            <span class="room-pill">${escapeHtml(classifyDocument(document.title))}</span>
            <span class="doc-path">${escapeHtml(document.id)}</span>
          </div>
          <h3>${escapeHtml(document.title)}</h3>
          <p>${escapeHtml(document.path)}</p>
        </article>
      `
    )
    .join("");
}

function renderApplicants() {
  applicantList.innerHTML = state.applicants
    .map((applicant) => {
      const active = applicant.id === state.selectedApplicantId ? " applicant-card-active" : "";
      return `
        <button type="button" class="applicant-card${active}" data-applicant-id="${escapeHtml(applicant.id)}">
          <div class="applicant-card-top">
            <span class="room-pill">${escapeHtml(applicant.industry)}</span>
            <span class="score-pill">${escapeHtml(applicant.headline)}</span>
          </div>
          <h3>${escapeHtml(applicant.businessName)}</h3>
          <p>${escapeHtml(formatCurrency(applicant.requestedAmount))} · ${escapeHtml(humanizeProduct(applicant.requestedProduct))}</p>
          <div class="mini-chip-row">
            ${applicant.quickLook.map((item) => `<span class="mini-chip">${escapeHtml(item)}</span>`).join("")}
          </div>
        </button>
      `;
    })
    .join("");

  applicantList.querySelectorAll("[data-applicant-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedApplicantId = button.getAttribute("data-applicant-id");
      renderApplicants();
      await runUnderwrite();
    });
  });
}

async function runUnderwrite() {
  if (!state.selectedApplicantId) {
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Scoring...";
  underwritingHeadline.textContent = "Running the underwriting memo...";
  policyQuery.textContent = "Preparing policy retrieval terms...";
  memoSections.innerHTML = "";
  metricsGrid.innerHTML = "";
  strengthsList.innerHTML = "";
  flagsList.innerHTML = "";
  trendBody.innerHTML = "";
  transactionBody.innerHTML = "";
  evidenceList.innerHTML = "";
  traceBody.innerHTML = "";

  const response = await fetch("/api/underwrite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ applicantId: state.selectedApplicantId })
  });
  const analysis = await response.json();
  state.analysis = analysis;

  renderAnalysis(analysis);
  renderPromptChips(analysis);
  queryMeta.textContent = `Ask a policy question for ${analysis.applicant.businessName}.`;
  answerBody.textContent = "Use the prompts or ask your own question to inspect the policy basis for the decision.";
  warningList.innerHTML = "";

  analyzeButton.disabled = false;
  analyzeButton.textContent = "Run Underwriting";
}

function renderAnalysis(analysis) {
  underwritingHeadline.textContent = analysis.headline;
  policyQuery.textContent = `Policy query: ${analysis.policyQuery}`;
  decisionBadge.textContent = analysis.decision.verdict;
  decisionBadge.className = `badge verdict-badge tone-${decisionTone(analysis.decision.verdict)}`;
  confidenceBadge.textContent = `Confidence ${Number(analysis.decision.confidence).toFixed(2)}`;
  confidenceBadge.className = "badge badge-soft";

  memoSections.innerHTML = analysis.memoSections
    .map(
      (section) => `
        <article class="memo-section">
          <h3>${escapeHtml(section.title)}</h3>
          <ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
        </article>
      `
    )
    .join("");

  metricsGrid.innerHTML = analysis.metrics
    .map(
      (metric) => `
        <article class="metric-card tone-${escapeHtml(metric.tone)}">
          <span class="metric-label">${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.displayValue)}</strong>
          <p>${escapeHtml(metric.note)}</p>
        </article>
      `
    )
    .join("");

  strengthsList.innerHTML = renderInsightCards(analysis.strengths, "No standout positive signals were detected.");
  flagsList.innerHTML = renderInsightCards(analysis.flags, "No material risk flags crossed a threshold.");
  trendBody.innerHTML = renderTrend(analysis.monthlySeries);
  transactionBody.innerHTML = renderTransactions(analysis.transactionHighlights);
  renderEvidence(analysis.evidence || []);
  renderTrace(analysis.retrievalTrace || {});
}

function renderInsightCards(items, emptyMessage) {
  if (!items.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  return items
    .map(
      (item) => `
        <article class="insight-card tone-${escapeHtml(item.severity)}">
          <h3>${escapeHtml(item.label)}</h3>
          <p>${escapeHtml(item.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderTrend(monthlySeries) {
  if (!monthlySeries.length) {
    return `<div class="empty-state">No monthly trend available.</div>`;
  }

  const maxOutflow = Math.max(...monthlySeries.map((item) => Math.max(item.inflow, item.outflow)), 1);
  return monthlySeries
    .map(
      (item) => `
        <article class="trend-card">
          <div class="trend-top">
            <h3>${escapeHtml(item.month)}</h3>
            <span>${escapeHtml(formatCurrency(item.endBalance))}</span>
          </div>
          <div class="trend-bars">
            <div class="trend-bar trend-bar-inflow"><span style="height:${Math.max(12, (item.inflow / maxOutflow) * 100)}%"></span></div>
            <div class="trend-bar trend-bar-outflow"><span style="height:${Math.max(12, (item.outflow / maxOutflow) * 100)}%"></span></div>
          </div>
          <div class="trend-meta">
            <span>Inflow ${escapeHtml(formatCurrency(item.inflow))}</span>
            <span>Outflow ${escapeHtml(formatCurrency(item.outflow))}</span>
          </div>
          <div class="trend-net ${item.net >= 0 ? "positive" : "negative"}">Net ${escapeHtml(formatCurrency(item.net))}</div>
        </article>
      `
    )
    .join("");
}

function renderTransactions(transactions) {
  if (!transactions.length) {
    return `<div class="empty-state">No notable transactions were surfaced.</div>`;
  }

  return transactions
    .map(
      (transaction) => `
        <article class="transaction-card tone-${escapeHtml(transaction.tone)}">
          <div class="transaction-top">
            <h3>${escapeHtml(transaction.title)}</h3>
            <span>${escapeHtml(formatCurrency(transaction.amount))}</span>
          </div>
          <p>${escapeHtml(transaction.date)} · ${escapeHtml(transaction.detail)}</p>
        </article>
      `
    )
    .join("");
}

function renderPromptChips(analysis) {
  const prompts = [
    `Why does this file justify ${analysis.decision.verdict.toLowerCase()} instead of a cleaner structure?`,
    `Which policy thresholds matter most for ${analysis.applicant.businessName}?`,
    `Should analysts tighten reserve or monitoring requirements here?`,
    analysis.applicant.requestedProduct === "invoice_advance"
      ? "What keeps this receivables book eligible for the current advance-rate band?"
      : "What would move this borrower onto the watchlist after funding?"
  ];

  promptChips.innerHTML = prompts
    .map((prompt) => `<button type="button" class="chip-button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`)
    .join("");

  promptChips.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      queryInput.value = button.getAttribute("data-prompt") || "";
      queryInput.focus();
    });
  });
}

async function handleAsk(event) {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query || !state.selectedApplicantId) {
    return;
  }

  queryMeta.textContent = `Running grounded answer for: ${query}`;
  answerBody.textContent = "Retrieving policy evidence...";
  warningList.innerHTML = "";

  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ applicantId: state.selectedApplicantId, query })
  });
  const answer = await response.json();

  queryMeta.textContent = `Question: ${query}`;
  answerBody.innerHTML = `<p>${escapeHtml(answer.answer)}</p>`;
  renderWarnings(answer.warnings || []);
  renderEvidence(answer.evidence || []);
  renderTrace(answer.retrievalTrace || {});
}

async function handleEval() {
  evaluationBody.textContent = "Running retrieval health check...";
  const response = await fetch("/api/eval");
  const report = await response.json();

  evaluationBody.innerHTML = `
    <div class="metrics-grid">
      ${metricSummaryCard("Recall@5", report.aggregate.recallAt5)}
      ${metricSummaryCard("Recall@10", report.aggregate.recallAt10)}
      ${metricSummaryCard("MRR@10", report.aggregate.mrrAt10)}
      ${metricSummaryCard("nDCG@10", report.aggregate.ndcgAt10)}
      ${metricSummaryCard("Support", report.aggregate.supportRate)}
    </div>
    <div class="subsection-label">Evaluation queries</div>
    <div class="result-table">
      <div class="result-row result-row-head"><span>Query</span><span>R@5</span><span>MRR</span><span>Support</span></div>
      ${report.results
        .map(
          (result) => `
            <div class="result-row">
              <span>${escapeHtml(result.query)}</span>
              <span>${Number(result.recallAt5).toFixed(2)}</span>
              <span>${Number(result.mrrAt10).toFixed(2)}</span>
              <span>${Number(result.supportRate).toFixed(2)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

async function handleRebuild() {
  rebuildButton.disabled = true;
  rebuildButton.textContent = "Rebuilding...";
  await fetch("/api/rebuild", { method: "POST" });
  await Promise.all([refreshStatus(), loadDocuments()]);
  if (state.selectedApplicantId) {
    await runUnderwrite();
  }
  rebuildButton.disabled = false;
  rebuildButton.textContent = "Rebuild Index";
}

function renderWarnings(warnings) {
  warningList.innerHTML = warnings.map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`).join("");
}

function renderEvidence(evidence) {
  evidenceList.innerHTML = evidence.length
    ? evidence
        .map((item) => {
          const strength = Math.max(10, Math.min(100, Math.round(Number(item.fusedScore || item.score) * 900)));
          return `
            <article class="evidence-card">
              <div class="evidence-head">
                <h3>${escapeHtml(item.documentTitle)}</h3>
                <span class="room-pill">${escapeHtml(item.heading)}</span>
              </div>
              <div class="score-bar"><span style="width:${strength}%"></span></div>
              <p>${escapeHtml(item.text)}</p>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No evidence loaded yet.</div>`;
}

function renderTrace(trace) {
  const sections = [
    ["Query variants", (trace.variants || []).map((variant) => `${variant.label}: ${variant.text}`)],
    ["Lexical candidates", (trace.lexicalTopHits || []).map((hit) => `${hit.chunkId} (${Number(hit.score).toFixed(3)})`)],
    ["Vector candidates", (trace.vectorTopHits || []).map((hit) => `${hit.chunkId} (${Number(hit.score).toFixed(3)})`)],
    ["Fused slate", (trace.fusedTopHits || []).map((hit) => `${hit.chunkId} (${Number(hit.score).toFixed(3)})`)]
  ];

  traceBody.innerHTML = sections
    .map(
      ([title, items]) => `
        <article class="trace-card">
          <h3>${escapeHtml(title)}</h3>
          <div class="trace-list">
            ${(items.length ? items : ["No items"]).map((item) => `<div class="trace-item">${escapeHtml(item)}</div>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function metricSummaryCard(label, value) {
  return `
    <article class="metric-card tone-neutral">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong>${Number(value).toFixed(2)}</strong>
      <p>Retrieval benchmark score.</p>
    </article>
  `;
}

function classifyDocument(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes("invoice")) return "Advance policy";
  if (normalized.includes("bank statement")) return "Statement policy";
  if (normalized.includes("revenue")) return "Revenue quality";
  if (normalized.includes("covenant")) return "Monitoring";
  if (normalized.includes("fraud") || normalized.includes("kyb")) return "Fraud controls";
  if (normalized.includes("committee")) return "Committee brief";
  return "Underwriting";
}

function humanizeProduct(product) {
  return product === "invoice_advance" ? "invoice advance" : "working capital line";
}

function decisionTone(verdict) {
  if (verdict === "Approve") return "positive";
  if (verdict === "Approve with reserve" || verdict === "Manual review") return "watch";
  return "critical";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

askForm.addEventListener("submit", handleAsk);
analyzeButton.addEventListener("click", runUnderwrite);
rebuildButton.addEventListener("click", handleRebuild);
evalButton.addEventListener("click", handleEval);

await Promise.all([refreshStatus(), loadApplicants(), loadDocuments()]);
if (state.selectedApplicantId) {
  await runUnderwrite();
}
