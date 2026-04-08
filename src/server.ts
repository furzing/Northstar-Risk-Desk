import path from "node:path";
import { answerQuestion } from "./core/answerer";
import { config } from "./core/config";
import { runEvaluation } from "./core/evaluator";
import { buildIndex, loadIndex } from "./core/indexer";
import { answerUnderwritingQuestion, listApplicantCards, underwriteApplicant } from "./core/underwriting";

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
    "/api/applicants": {
      GET: async () => {
        const applicants = await listApplicantCards();
        return Response.json(applicants);
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
        const body = (await request.json()) as { applicantId?: string; query?: string };
        const query = body.query?.trim();

        if (!query) {
          return Response.json({ error: "Missing query" }, { status: 400 });
        }

        const answer = body.applicantId
          ? await answerUnderwritingQuestion(body.applicantId, query)
          : await answerQuestion(query);
        return Response.json(answer);
      }
    },
    "/api/underwrite": {
      POST: async (request) => {
        const body = (await request.json()) as { applicantId?: string };
        const applicantId = body.applicantId?.trim();

        if (!applicantId) {
          return Response.json({ error: "Missing applicantId" }, { status: 400 });
        }

        const result = await underwriteApplicant(applicantId);
        return Response.json(result);
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

console.log(`FlowScore AI listening on http://localhost:${server.port}`);
