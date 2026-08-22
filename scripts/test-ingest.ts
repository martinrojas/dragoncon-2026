import { runIngestion } from "../lib/ingest";

async function main() {
  console.log("Running test ingestion...");
  const result = await runIngestion({
    days: ["Sep++3"],
    maxDetailFetches: 5,
    onProgress: (msg) => console.log(`[INGEST] ${msg}`),
  });
  console.log("Result:", result);
}

main().catch(console.error);
