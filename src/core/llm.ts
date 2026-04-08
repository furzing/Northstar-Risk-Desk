import type { Evidence } from "./types";

export interface LlmProvider {
  readonly name: string;
  generateGroundedAnswer(query: string, evidence: Evidence[]): Promise<string>;
}

export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly name = "openai-compatible";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generateGroundedAnswer(query: string, evidence: Evidence[]): Promise<string> {
    const evidenceBlock = evidence
      .map(
        (item, index) =>
          `[${index + 1}] ${item.documentTitle} / ${item.heading}\n${item.text}`
      )
      .join("\n\n");

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "Answer only from the supplied evidence. Cite supporting evidence with bracketed numbers. If the evidence is insufficient, say so."
          },
          {
            role: "user",
            content: `Question: ${query}\n\nEvidence:\n${evidenceBlock}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

export function getOptionalLlmProvider(): LlmProvider | null {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!baseUrl || !apiKey) {
    return null;
  }

  return new OpenAiCompatibleLlmProvider(baseUrl, apiKey, model);
}
