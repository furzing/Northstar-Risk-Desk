import path from "node:path";
import { answerQuestion } from "./core/answerer";
import { config } from "./core/config";
import { runEvaluation } from "./core/evaluator";
import { buildIndex, loadIndex } from "./core/indexer";

const server = Bun.serve({
  port: config.serverPort,
  routes: {
    "/api/status": {
      GET: async () => {
        const index = await loadIndex();
        return Response.json({
          ok: true,
          builtAt: index.builtAt,
          documents: index.documents.length,
          chunks: index.chunks.length
        });
      }
    },
    "/api/documents": {
      GET: async () => {
        const index = await loadIndex();
        return Response.json(index.documents);
      }
    },
    "/api/rebuild": {
      POST: async () => {
        const index = await buildIndex();
        return Response.json({
          ok: true,
          builtAt: index.builtAt,
          documents: index.documents.length,
          chunks: index.chunks.length
        });
      }
    },
    "/api/ask": {
      POST: async (request) => {
        const body = (await request.json()) as { query?: string };
        const query = body.query?.trim();

        if (!query) {
          return Response.json({ error: "Missing query" }, { status: 400 });
        }

        const answer = await answerQuestion(query);
        return Response.json(answer);
      }
    },
    "/api/eval": {
      GET: async () => {
        const report = await runEvaluation();
        return Response.json(report);
      }
    },
    "/*": () => {
      const filePath = path.join(config.publicDir, "index.html");
      return new Response(Bun.file(filePath));
    }
  },
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) {
      const assetPath = path.join(config.publicDir, url.pathname);
      return new Response(Bun.file(assetPath));
    }

    const filePath = path.join(config.publicDir, "index.html");
    return new Response(Bun.file(filePath), {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  }
});

console.log(`Northstar Risk Desk listening on http://localhost:${server.port}`);
