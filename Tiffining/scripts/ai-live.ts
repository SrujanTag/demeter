import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { AppError } from "../lib/contracts/common";
import { callGemma, callJev, boundedStage, type ProviderMetadata } from "../lib/server/ai/nvidia";
import { getAiConfig } from "../lib/server/ai/config";
import { PROMPT_VERSION } from "../lib/server/ai/prompts";
import { run } from "./run";

void run(async () => {
  if (process.argv.slice(2).join(" ") !== "--allow-provider-spend") {
    throw new AppError(
      "USAGE",
      "Use pnpm test:ai:live --allow-provider-spend after confirming models, credits and retention. This sends only a fixed fictional source; it is not an authenticated API test.",
      422
    );
  }
  const config = getAiConfig();
  const id = randomUUID();
  const path = `.private/ai-live-${id}.json`;
  const source = {
    text: "only one tomorrow",
    sentAt: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    alias: "Fictional A",
    schedule: [{ startDate: "2026-01-01", endDate: null, quantities: [2, 2, 2, 2, 2, 2, 2] }],
  };
  const manifest: {
    createdAt: string;
    promptVersion: string;
    stages: { stage: string; metadata: ProviderMetadata }[];
    verified: boolean;
  } = {
    createdAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
    stages: [],
    verified: false,
  };

  await mkdir(".private", { recursive: true, mode: 0o700 });
  const persist = () => writeFile(path, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await persist();

  const observe = (stage: string) => async (metadata: ProviderMetadata) => {
    manifest.stages.push({ stage, metadata });
    await persist();
  };

  const gemma = await boundedStage(callGemma(source, config, observe("gemma")), config.stageTimeoutMs);
  if (!gemma.metadata.resolvedModel) {
    throw new AppError("LIVE_PROOF_INCOMPLETE", "Resolved Gemma extraction model provenance missing.", 502);
  }

  const jev = await boundedStage(callJev(source, gemma.extraction, config, observe("jev")), config.stageTimeoutMs);
  if (!jev.metadata.resolvedModel) {
    throw new AppError("LIVE_PROOF_INCOMPLETE", "Resolved verification model provenance missing.", 502);
  }

  manifest.verified = true;
  await persist();
  console.log(
    `Synthetic NVIDIA NIM extraction and verification contracts verified; ${gemma.extraction.candidates.length} review candidates. Private provenance: ${path}. No orders or approvals were created.`
  );
});
