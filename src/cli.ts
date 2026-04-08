import { answerQuestion } from "./core/answerer";
import { runEvaluation } from "./core/evaluator";
import { buildIndex } from "./core/indexer";

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
    case "eval": {
      const report = await runEvaluation();
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    default:
      console.log("Commands: build-index | ask <query> | eval");
  }
}

void main();
