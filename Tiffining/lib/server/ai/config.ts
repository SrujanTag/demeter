import "server-only";
import { AppError } from "@/lib/contracts/common";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  gemmaProvider: string;
  gemmaModel: string;
  jevModel: string;
  dailyRequestLimit: number;
  dailyInputTokenLimit: number;
  maxInputTokens: number;
  maxSourceChars: number;
  maxOutputChars: number;
  stageTimeoutMs: number;
  totalTimeoutMs: number;
}

type Environment = Record<string, string | undefined>;
const modelName = (value: string) => value.length >= 4 && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);

export function validateAiConfig(env: Environment = process.env): AiConfig {
  const apiKey = env.NVIDIA_API_KEY?.trim() || env.BACKBOARD_API_KEY?.trim() || "";
  const baseUrl = env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1";
  const gemmaProvider = env.NVIDIA_PROVIDER?.trim() || env.GEMMA_PROVIDER?.trim() || "nvidia";
  const gemmaModel = env.NVIDIA_EXTRACTION_MODEL?.trim() || env.GEMMA_MODEL?.trim() || "google/gemma-2-27b-it";
  const jevModel = env.NVIDIA_VERIFICATION_MODEL?.trim() || env.JEV_MODEL?.trim() || "nvidia/llama-3.1-nemotron-70b-instruct";

  if (!apiKey || !/^[a-z][a-z0-9_-]{1,49}$/.test(gemmaProvider) || !modelName(gemmaModel) || !modelName(jevModel)) {
    throw new AppError("AI_NOT_CONFIGURED", "Explicit NVIDIA API key and models configuration is required.", 503);
  }

  const integer = (key: string, fallback: number, max: number) => {
    const raw = env[key]?.trim();
    const value = raw ? Number(raw) : fallback;
    if (!Number.isSafeInteger(value) || value < 1 || value > max) {
      throw new AppError("AI_NOT_CONFIGURED", "AI budget configuration is invalid.", 503);
    }
    return value;
  };

  return {
    apiKey,
    baseUrl,
    gemmaProvider,
    gemmaModel,
    jevModel,
    dailyRequestLimit: integer("AI_DAILY_REQUEST_LIMIT", 100, 10000),
    dailyInputTokenLimit: integer("AI_DAILY_INPUT_TOKEN_LIMIT", 1000000, 10000000),
    maxInputTokens: integer("AI_MAX_INPUT_TOKENS", 16000, 100000),
    maxSourceChars: integer("AI_MAX_SOURCE_CHARS", 8000, 8000),
    maxOutputChars: integer("AI_MAX_OUTPUT_CHARS", 12000, 32000),
    stageTimeoutMs: integer("AI_STAGE_TIMEOUT_MS", 20000, 30000),
    totalTimeoutMs: integer("AI_TOTAL_TIMEOUT_MS", 45000, 60000),
  };
}

export const getAiConfig = validateAiConfig;

export function aiCapabilityFlags(env: Environment = process.env) {
  let configured = false;
  try {
    validateAiConfig(env);
    configured = true;
  } catch {
    /* nonsecret availability only */
  }

  const apiKey = env.NVIDIA_API_KEY?.trim() || env.BACKBOARD_API_KEY?.trim() || "";
  const gemmaProvider = env.NVIDIA_PROVIDER?.trim() || env.GEMMA_PROVIDER?.trim() || "nvidia";
  const gemmaModel = env.NVIDIA_EXTRACTION_MODEL?.trim() || env.GEMMA_MODEL?.trim() || "google/gemma-2-27b-it";
  const jevModel = env.NVIDIA_VERIFICATION_MODEL?.trim() || env.JEV_MODEL?.trim() || "nvidia/llama-3.1-nemotron-70b-instruct";

  return {
    ai: {
      configured,
      gemmaConfigured: Boolean(apiKey && /^[a-z][a-z0-9_-]{1,49}$/.test(gemmaProvider) && modelName(gemmaModel)),
      jevConfigured: Boolean(apiKey && modelName(jevModel)),
      mode: "bounded_sync" as const,
      requiresConsent: true as const,
    },
    forecasting: { configured: Boolean(env.TABPFN_SERVICE_URL?.trim() && env.TABPFN_SERVICE_TOKEN?.trim()) },
    privacyExport: true as const,
  };
}
