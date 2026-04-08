const statusBuiltAt = document.getElementById("status-built-at");
const statusDocuments = document.getElementById("status-documents");
const statusChunks = document.getElementById("status-chunks");
const askForm = document.getElementById("ask-form");
const queryInput = document.getElementById("query-input");
const queryMeta = document.getElementById("query-meta");
const answerBody = document.getElementById("answer-body");
const warningList = document.getElementById("warning-list");
const evidenceList = document.getElementById("evidence-list");
const traceBody = document.getElementById("trace-body");
const documentList = document.getElementById("document-list");
const evaluationBody = document.getElementById("evaluation-body");
const confidenceBadge = document.getElementById("confidence-badge");
const rebuildButton = document.getElementById("rebuild-button");
const evalButton = document.getElementById("eval-button");
const promptChips = document.getElementById("prompt-chips");

const SUGGESTED_PROMPTS = [
  "Why does treasury monitor warehouse utilization and settlement lag together?",
  "What conditions trigger a rolling reserve increase for a merchant?",
  "When does AML review escalate to enhanced due diligence?",
  "How is first-party fraud different from account takeover?",
  "How should payment operations respond when same-day funding causes ACH returns to spike?"
];

async function refreshStatus() {
  const response = await fetch("/api/status");
  const status = await response.json();

  statusBuiltAt.textContent = new Date(status.builtAt).toLocaleString();
  statusDocuments.textContent = String(status.documents);
  statusChunks.textContent = String(status.chunks);
}

async function loadDocuments() {
  const response = await fetch("/api/documents");
  const documents = await response.json();

  documentList.innerHTML = documents
    .map((document) => {
      const room = classifyDocument(document.title);
      return `
        <article class="doc-card">
          <div class="doc-card-top">
            <span class="room-pill">${escapeHtml(room)}</span>
            <span class="doc-path">${escapeHtml(document.id)}</span>
          </div>
          <h3>${escapeHtml(document.title)}</h3>
          <p>${escapeHtml(document.path)}</p>
        </article>
      `;
    })
    .join("");
}

function renderPromptChips() {
  promptChips.innerHTML = SUGGESTED_PROMPTS.map(
    (prompt) => `<button type="button" class="chip-button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`
  ).join("");

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
  if (!query) {
    return;
  }

  queryMeta.textContent = `Running grounded brief for: ${query}`;
  answerBody.textContent = "Running retrieval and synthesizing the brief...";
  warningList.innerHTML = "";
  evidenceList.innerHTML = "";
  traceBody.innerHTML = "";

  const response = await fetch("/api/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  const answer = await response.json();

  queryMeta.textContent = `Query: ${query}`;
  answerBody.innerHTML = `<p>${escapeHtml(answer.answer)}</p>`;
  confidenceBadge.textContent = `Confidence: ${Number(answer.confidence).toFixed(2)}`;

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
      ${metricCard("Recall@5", report.aggregate.recallAt5)}
      ${metricCard("Recall@10", report.aggregate.recallAt10)}
      ${metricCard("MRR@10", report.aggregate.mrrAt10)}
      ${metricCard("nDCG@10", report.aggregate.ndcgAt10)}
      ${metricCard("Support", report.aggregate.supportRate)}
    </div>
    <div class="subsection-label">Query set detail</div>
    <div class="result-table">
      <div class="result-row result-row-head">
        <span>Query</span>
        <span>R@5</span>
        <span>MRR</span>
        <span>Support</span>
      </div>
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
  rebuildButton.disabled = false;
  rebuildButton.textContent = "Rebuild Index";
}

function renderWarnings(warnings) {
  warningList.innerHTML = warnings.map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`).join("");
}

function renderEvidence(evidence) {
  evidenceList.innerHTML = evidence
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
    .join("");
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

function classifyDocument(title) {
  const normalized = title.toLowerCase();

  if (normalized.includes("treasury") || normalized.includes("liquidity")) {
    return "Treasury";
  }
  if (normalized.includes("underwriting") || normalized.includes("bnpl")) {
    return "Credit";
  }
  if (normalized.includes("fraud")) {
    return "Fraud";
  }
  if (normalized.includes("aml")) {
    return "Compliance";
  }
  if (normalized.includes("payment") || normalized.includes("card")) {
    return "Payments";
  }
  return "Risk";
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <h3>${escapeHtml(label)}</h3>
      <strong>${Number(value).toFixed(2)}</strong>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

askForm.addEventListener("submit", handleAsk);
rebuildButton.addEventListener("click", handleRebuild);
evalButton.addEventListener("click", handleEval);

renderPromptChips();
void Promise.all([refreshStatus(), loadDocuments()]);
