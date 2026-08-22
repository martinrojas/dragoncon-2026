import { runIngestion } from "../lib/ingest";

async function seed() {
  console.log("Fetching live Dragon Con 2026 schedule data...");
  const result = await runIngestion({
    days: ["Sep++3", "Sep++4"],
    maxDetailFetches: 25,
    onProgress: (msg) => console.log(`[SEED] ${msg}`),
  });
  console.log("Seed result:", result);
}

seed().catch(console.error);
