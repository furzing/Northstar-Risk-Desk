import { answerQuestion } from "./core/answerer";
import { runEvaluation } from "./core/evaluator";
import { buildIndex } from "./core/indexer";
import { answerUnderwritingQuestion, listApplicantCards, underwriteApplicant } from "./core/underwriting";

const [, , command, ...rest] = process.argv;

async function main(): Promise<void> {
  switch (command) {
    case "build-index": {
      const index = await buildIndex();
      console.log(
        JSON.stringify(
          {
            builtAt: index.builtAt,
            documents: index.documents.length,
            chunks: index.chunks.length,
            vectorDimension: index.vectorDimension
          },
          null,
          2
        )
      );
      break;
    }
    case "ask": {
      const query = rest.join(" ").trim();
      if (!query) {
        throw new Error("Usage: bun run src/cli.ts ask \"your question\"");
      }

      const answer = await answerQuestion(query);
      console.log(JSON.stringify(answer, null, 2));
      break;
    }
    case "list-applicants": {
      const applicants = await listApplicantCards();
      console.log(JSON.stringify(applicants, null, 2));
      break;
    }
    case "underwrite": {
      const applicantId = rest[0]?.trim();
      if (!applicantId) {
        throw new Error("Usage: bun run src/cli.ts underwrite <applicant-id>");
      }

      const result = await underwriteApplicant(applicantId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "ask-applicant": {
      const applicantId = rest[0]?.trim();
      const query = rest.slice(1).join(" ").trim();
      if (!applicantId || !query) {
        throw new Error("Usage: bun run src/cli.ts ask-applicant <applicant-id> \"your question\"");
      }

      const answer = await answerUnderwritingQuestion(applicantId, query);
      console.log(JSON.stringify(answer, null, 2));
      break;
    }
    case "eval": {
      const report = await runEvaluation();
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    default:
      console.log("Commands: build-index | ask <query> | list-applicants | underwrite <id> | ask-applicant <id> <query> | eval");
  }
}

void main();
