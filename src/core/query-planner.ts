import { tokenize } from "./tokenization";
import type { QueryVariant } from "./types";

const DOMAIN_EXPANSIONS: Record<string, string[]> = {
  ach: ["automated clearing house", "bank debit"],
  aml: ["anti money laundering", "financial crime review"],
  bnpl: ["buy now pay later", "installment lending"],
  edd: ["enhanced due diligence", "heightened review"],
  kyc: ["know your customer", "identity verification"],
  nim: ["net interest margin", "spread income"],
  psp: ["payment service provider", "processor"],
  sar: ["suspicious activity report", "suspicious activity review"],
  mcc: ["merchant category code", "merchant vertical"],
  reserve: ["rolling reserve", "cash holdback"],
  delinquency: ["late repayment", "30 plus day delinquency"]
};

const INTENT_PRIORS: Record<string, string[]> = {
  compare: ["difference", "trade offs", "control design", "risk"],
  explain: ["because", "operating logic", "why", "causal note"],
  assess: ["risk", "threshold", "exposure", "pressure"],
  escalate: ["trigger", "threshold", "manual review", "enhanced due diligence"],
  monitor: ["watchlist", "trend", "threshold", "scorecard"],
  respond: ["recommended response", "cross functional actions", "funding buffer"],
  summarize: ["executive summary", "watchlist", "management actions"]
};

export function planQueryVariants(query: string): QueryVariant[] {
  const tokens = tokenize(query, { keepStopwords: true });
  const variants: QueryVariant[] = [{ label: "original", text: query.trim(), weight: 1 }];

  const compressed = tokenize(query).join(" ");
  if (compressed && compressed !== query.toLowerCase()) {
    variants.push({ label: "compressed", text: compressed, weight: 0.88 });
  }

  const expandedTokens = tokens.flatMap((token) => {
    const expansions = DOMAIN_EXPANSIONS[token] ?? [];
    return expansions.length ? [token, ...expansions] : [token];
  });
  const expanded = expandedTokens.join(" ").trim();
  if (expanded && expanded !== query.toLowerCase()) {
    variants.push({ label: "expanded", text: expanded, weight: 0.82 });
  }

  for (const [intent, priors] of Object.entries(INTENT_PRIORS)) {
    if (query.toLowerCase().includes(intent)) {
      variants.push({
        label: `${intent}-prior`,
        text: `${query} ${priors.join(" ")}`,
        weight: 0.76
      });
    }
  }

  return deduplicateVariants(variants);
}

function deduplicateVariants(variants: QueryVariant[]): QueryVariant[] {
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key = variant.text.toLowerCase().trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
