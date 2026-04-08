import { config } from "./config";
import { countApproximateTokens } from "./tokenization";
import type { Chunk, SourceDocument } from "./types";

interface Section {
  heading: string;
  text: string;
}

export function chunkDocuments(documents: SourceDocument[]): Chunk[] {
  const chunks: Chunk[] = [];

  for (const document of documents) {
    const sections = splitSections(document);
    let order = 0;

    for (const section of sections) {
      const sectionChunks = chunkSection(section.text, config.chunkSize, config.chunkOverlap);

      for (const text of sectionChunks) {
        chunks.push({
          id: `${document.id}::${String(order).padStart(3, "0")}`,
          documentId: document.id,
          documentTitle: document.title,
          order,
          heading: section.heading,
          text,
          tokenCount: countApproximateTokens(text),
          metadata: {
            section: section.heading
          }
        });
        order += 1;
      }
    }
  }

  return chunks;
}

function splitSections(document: SourceDocument): Section[] {
  const sections: Section[] = [];
  const lines = document.body.split(/\r?\n/);
  let heading = document.title;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (!text) {
      return;
    }

    sections.push({ heading, text });
    buffer = [];
  };

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (match) {
      flush();
      heading = match[2]!.trim();
      continue;
    }

    buffer.push(line);
  }

  flush();
  return sections;
}

function chunkSection(text: string, targetSize: number, overlap: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    const candidateTokens = countApproximateTokens(candidate);

    if (!current || candidateTokens <= targetSize) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    current = appendOverlap(current, paragraph, overlap);
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function appendOverlap(previousChunk: string, nextParagraph: string, overlap: number): string {
  const previousWords = previousChunk.split(/\s+/).filter(Boolean);
  const overlapWords = previousWords.slice(Math.max(0, previousWords.length - overlap));
  return `${overlapWords.join(" ")} ${nextParagraph}`.trim();
}
