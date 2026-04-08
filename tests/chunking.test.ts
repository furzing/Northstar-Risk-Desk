import { describe, expect, test } from "bun:test";
import { chunkDocuments } from "../src/core/chunking";
import type { SourceDocument } from "../src/core/types";

describe("chunkDocuments", () => {
  test("preserves headings and emits stable chunk ids", () => {
    const documents: SourceDocument[] = [
      {
        id: "demo-doc",
        title: "Demo Doc",
        path: "demo.md",
        format: "markdown",
        metadata: {},
        body: `# Demo Doc

## Section One

This section explains the first idea in detail.

## Section Two

This section explains the second idea in detail.`
      }
    ];

    const chunks = chunkDocuments(documents);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.id).toBe("demo-doc::000");
    expect(chunks.some((chunk) => chunk.heading === "Section One")).toBe(true);
    expect(chunks.some((chunk) => chunk.heading === "Section Two")).toBe(true);
  });
});
