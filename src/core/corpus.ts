import path from "node:path";
import { config } from "./config";
import type { DocumentFormat, SourceDocument } from "./types";

const SUPPORTED_EXTENSIONS = new Map<string, DocumentFormat>([
  [".md", "markdown"],
  [".txt", "text"],
  [".json", "json"]
]);

export async function loadCorpus(directory = config.corpusDir): Promise<SourceDocument[]> {
  const files = await collectFiles(directory);
  const documents = await Promise.all(
    files.map(async (filePath) => {
      const body = await Bun.file(filePath).text();
      const extension = path.extname(filePath).toLowerCase();
      const format = SUPPORTED_EXTENSIONS.get(extension);

      if (!format) {
        return null;
      }

      return parseDocument(filePath, body, format);
    })
  );

  return documents.filter((document): document is SourceDocument => Boolean(document));
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: directory, absolute: true }));
  return entries
    .filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}

function parseDocument(filePath: string, rawBody: string, format: DocumentFormat): SourceDocument {
  if (format === "json") {
    const json = JSON.parse(rawBody) as {
      id?: string;
      title?: string;
      body?: string;
      metadata?: Record<string, string>;
    };

    return {
      id: json.id ?? slugify(path.basename(filePath, ".json")),
      title: json.title ?? titleize(path.basename(filePath, ".json")),
      path: filePath,
      format,
      metadata: json.metadata ?? {},
      body: json.body ?? ""
    };
  }

  const derivedId = slugify(path.basename(filePath, path.extname(filePath)));
  const lines = rawBody.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith("# "));

  return {
    id: derivedId,
    title: titleLine ? titleLine.replace(/^#\s+/, "").trim() : titleize(derivedId),
    path: filePath,
    format,
    metadata: {},
    body: rawBody
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}
