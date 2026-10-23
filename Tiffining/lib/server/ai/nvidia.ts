import "server-only";
import { AppError } from "@/lib/contracts/common";
import type { AnalysisRunView } from "@/lib/contracts/intelligence";
import { getAiConfig, type AiConfig } from "./config";
import { EXTRACTION_PROMPT, VERIFICATION_PROMPT, gemmaContent, jevContent, type ModelSourceContext } from "./prompts";
import { intentLabels, jevResultSchema, validateExtractionEvidence, type Extraction, type JevResult } from "./schemas";

export interface ProviderIds {
  assistantId?: string;
  threadId?: string;
  messageId?: string;
  runId?: string;
}

export interface ProviderMetadata {
  ids: ProviderIds;
  resolvedModel: string | null;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

export type ProviderObserver = (metadata: ProviderMetadata) => Promise<void>;

export class AiStageError extends AppError {
  constructor(
    code: string,
    status: number,
    public readonly unknownOutcome = false,
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(code, "AI stage did not produce a validated result. Review the saved run before an explicit retry.", status);
  }
}

export function safeAiError(error: unknown): NonNullable<AnalysisRunView["error"]> {
  const mapped = error instanceof AiStageError ? error : new AiStageError("PROVIDER_OUTCOME_UNKNOWN", 503, true);
  return { code: mapped.code, message: mapped.message, status: mapped.status, retryAfterSeconds: mapped.retryAfterSeconds };
}

export function mapProviderError(error: unknown, status?: number, retryAfterHeader?: string | null): AiStageError {
  if (error instanceof AiStageError) return error;

  if (status === 402) {
    return new AiStageError("PROVIDER_CREDIT_REQUIRED", 502);
  }
  if (status === 400 || status === 404 || status === 422) {
    return new AiStageError("PROVIDER_CONTRACT_ERROR", 502);
  }
  if (status === 429) {
    const seconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Math.min(Number(retryAfterHeader), 86400) : null;
    return new AiStageError("PROVIDER_RATE_LIMITED", 429, false, seconds);
  }
  if (status === 504 || (error instanceof Error && error.name === "TimeoutError")) {
    return new AiStageError("PROVIDER_TIMEOUT", 504, true);
  }

  return new AiStageError("PROVIDER_OUTCOME_UNKNOWN", 503, true);
}

export function estimateInputTokens(content: string, systemPrompt = ""): number {
  return Buffer.byteLength(content + systemPrompt, "utf8") + 256;
}

export function assertModelInput(content: string, config: AiConfig, systemPrompt = "") {
  if (estimateInputTokens(content, systemPrompt) > config.maxInputTokens) {
    throw new AppError("AI_INPUT_TOO_LARGE", "Source/context exceeds the configured input budget.", 422);
  }
}

export async function boundedStage<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AiStageError("PROVIDER_TIMEOUT", 504, true)), Math.max(1, timeoutMs));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sanitizeLlmExtraction(raw: unknown, text: string): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const clone = JSON.parse(JSON.stringify(raw));
  if (!("clarification" in clone) || clone.clarification === undefined) {
    clone.clarification = null;
  }
  if (Array.isArray(clone.candidates)) {
    for (const c of clone.candidates) {
      if (!c || typeof c !== "object") continue;
      if (!Array.isArray(c.missingFields)) c.missingFields = [];
      if (!("datePhrase" in c) || c.datePhrase === undefined) c.datePhrase = null;
      if (!("endDatePhrase" in c) || c.endDatePhrase === undefined) c.endDatePhrase = null;
      if (typeof c.quantity !== "number") c.quantity = null;

      if (Array.isArray(c.evidence)) {
        for (const ev of c.evidence) {
          if (ev && typeof ev.quote === "string") {
            const idx = text.indexOf(ev.quote);
            if (idx !== -1) {
              ev.start = idx;
              ev.end = idx + ev.quote.length;
            }
          }
        }

        if (typeof c.datePhrase === "string") {
          const hasDateInEvidence = c.evidence.some(
            (ev: { quote?: string }) => typeof ev.quote === "string" && ev.quote.includes(c.datePhrase!)
          );
          if (!hasDateInEvidence) {
            const pIdx = text.indexOf(c.datePhrase);
            if (pIdx !== -1) {
              if (c.evidence.length < 4) {
                c.evidence.push({ start: pIdx, end: pIdx + c.datePhrase.length, quote: c.datePhrase });
              } else if (c.evidence.length === 4) {
                c.evidence[3] = { start: pIdx, end: pIdx + c.datePhrase.length, quote: c.datePhrase };
              }
            }
          }
        }

        if (typeof c.endDatePhrase === "string") {
          const hasEndInEvidence = c.evidence.some(
            (ev: { quote?: string }) => typeof ev.quote === "string" && ev.quote.includes(c.endDatePhrase!)
          );
          if (!hasEndInEvidence) {
            const endIdx = text.indexOf(c.endDatePhrase);
            if (endIdx !== -1) {
              if (c.evidence.length < 4) {
                c.evidence.push({ start: endIdx, end: endIdx + c.endDatePhrase.length, quote: c.endDatePhrase });
              } else if (c.evidence.length === 4) {
                c.evidence[3] = { start: endIdx, end: endIdx + c.endDatePhrase.length, quote: c.endDatePhrase };
              }
            }
          }
        }
      }
    }
  }
  return clone;
}

function normalizeJevOutput(raw: unknown, model: string, inputTokens: number, outputTokens: number): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const clone = JSON.parse(JSON.stringify(raw));
  const answers = (clone.answers && typeof clone.answers === "object" ? clone.answers : clone) as Record<string, any>;

  // 1. Normalize intent
  if (!answers.intent || typeof answers.intent !== "object") {
    answers.intent = { choice: "unclear", probabilities: {}, confidence: 0.5 };
  }
  answers.intent.type = "choice";
  if (!answers.intent.probabilities || typeof answers.intent.probabilities !== "object") {
    answers.intent.probabilities = {};
  }
  const probs = answers.intent.probabilities;
  for (const label of intentLabels) {
    if (typeof probs[label] !== "number" || !Number.isFinite(probs[label]) || probs[label] < 0) {
      probs[label] = 0;
    }
  }
  const sum = Object.values(probs).reduce((a: number, b: any) => a + Number(b), 0);
  if (sum > 0) {
    for (const label of intentLabels) {
      probs[label] = Number((probs[label] / sum).toFixed(4));
    }
    const newSum = Object.values(probs).reduce((a: number, b: any) => a + Number(b), 0);
    const diff = Number((1 - newSum).toFixed(4));
    const target = answers.intent.choice in probs ? answers.intent.choice : intentLabels[0];
    probs[target] = Math.max(0, Math.min(1, Number((probs[target] + diff).toFixed(4))));
  } else {
    for (const label of intentLabels) {
      probs[label] = label === answers.intent.choice ? 1 : 0;
    }
  }
  if (typeof answers.intent.confidence !== "number" || !Number.isFinite(answers.intent.confidence)) {
    answers.intent.confidence = probs[answers.intent.choice] ?? 0.8;
  }

  // 2. Normalize explicitReplacement
  if (answers.explicitReplacement && typeof answers.explicitReplacement === "object") {
    answers.explicitReplacement.type = "noul";
    if (typeof answers.explicitReplacement.noul !== "number" || !Number.isFinite(answers.explicitReplacement.noul)) {
      answers.explicitReplacement.noul = 0;
    }
    answers.explicitReplacement.noul = Math.max(0, Math.min(1, answers.explicitReplacement.noul));
  } else {
    answers.explicitReplacement = { type: "noul", noul: 0 };
  }

  // 3. Normalize clarity
  if (!answers.clarity || typeof answers.clarity !== "object") {
    answers.clarity = { score: 1, legend: { "0": "Unclear or contradictory", "1": "Some necessary details missing", "2": "Explicit details stated" }, probabilities: {}, confidence: 0.8 };
  }
  answers.clarity.type = "score";
  if (!answers.clarity.legend || typeof answers.clarity.legend !== "object") {
    answers.clarity.legend = { "0": "Unclear or contradictory", "1": "Some necessary details missing", "2": "Explicit details stated" };
  }
  if (!answers.clarity.probabilities || typeof answers.clarity.probabilities !== "object") {
    answers.clarity.probabilities = {};
  }
  const cProbs = answers.clarity.probabilities;
  const legendKeys = Object.keys(answers.clarity.legend);
  for (const key of legendKeys) {
    if (typeof cProbs[key] !== "number" || !Number.isFinite(cProbs[key]) || cProbs[key] < 0) {
      cProbs[key] = 0;
    }
  }
  const cSum = legendKeys.reduce((a, k) => a + Number(cProbs[k]), 0);
  if (cSum > 0) {
    for (const key of legendKeys) {
      cProbs[key] = Number((cProbs[key] / cSum).toFixed(4));
    }
    const newCSum = legendKeys.reduce((a, k) => a + Number(cProbs[k]), 0);
    const diff = Number((1 - newCSum).toFixed(4));
    const targetKey = String(answers.clarity.score) in cProbs ? String(answers.clarity.score) : legendKeys[0];
    cProbs[targetKey] = Math.max(0, Math.min(1, Number((cProbs[targetKey] + diff).toFixed(4))));
  } else {
    for (const key of legendKeys) {
      cProbs[key] = key === String(answers.clarity.score) ? 1 : 0;
    }
  }
  if (typeof answers.clarity.confidence !== "number" || !Number.isFinite(answers.clarity.confidence)) {
    answers.clarity.confidence = cProbs[String(answers.clarity.score)] ?? 0.8;
  }
  if (typeof answers.clarity.score !== "number" || !Number.isFinite(answers.clarity.score)) {
    answers.clarity.score = 1;
  }

  return {
    model,
    answers,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

async function callNvidiaChatCompletions(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  model: string,
  config: AiConfig,
  temperature = 0.1,
  jsonFormat = true
): Promise<{ content: string; model: string; id: string; inputTokens: number; outputTokens: number }> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body: Record<string, any> = {
    model,
    messages,
    temperature,
    top_p: 0.7,
    max_tokens: 2048,
    stream: false,
  };
  if (jsonFormat) {
    body.response_format = { type: "json_object" };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw mapProviderError(err);
  }

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw mapProviderError(new Error(`NVIDIA NIM returned ${response.status}`), response.status, retryAfter);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    throw new AiStageError("INVALID_MODEL_OUTPUT", 502);
  }

  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (!choice || typeof content !== "string") {
    throw new AiStageError("INVALID_MODEL_OUTPUT", 502);
  }

  const inputTokens = typeof data.usage?.prompt_tokens === "number" ? data.usage.prompt_tokens : 0;
  const outputTokens = typeof data.usage?.completion_tokens === "number" ? data.usage.completion_tokens : 0;

  return {
    content,
    model: typeof data.model === "string" ? data.model : model,
    id: typeof data.id === "string" ? data.id : `nv-${Date.now()}`,
    inputTokens,
    outputTokens,
  };
}

export async function callGemma(
  source: ModelSourceContext,
  config: AiConfig = getAiConfig(),
  observe?: ProviderObserver
): Promise<{ extraction: Extraction; metadata: ProviderMetadata }> {
  const content = gemmaContent(source);
  assertModelInput(content, config, EXTRACTION_PROMPT);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: EXTRACTION_PROMPT },
    { role: "user", content },
  ];

  let raw;
  try {
    raw = await callNvidiaChatCompletions(messages, config.gemmaModel, config, 0.1, true);
  } catch (error) {
    throw mapProviderError(error);
  }

  const metadata: ProviderMetadata = {
    ids: { runId: raw.id, messageId: raw.id },
    resolvedModel: raw.model,
    usage: {
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
    },
  };

  if (observe) await observe(metadata);

  try {
    const rawContent = raw.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    if (!rawContent || rawContent.length > config.maxOutputChars) throw new Error("Invalid output length");
    const rawJson = JSON.parse(rawContent);
    const sanitized = sanitizeLlmExtraction(rawJson, source.text);
    return { extraction: validateExtractionEvidence(sanitized, source.text), metadata };
  } catch (error) {
    console.error("[NVIDIA NIM Extraction Error]", error, "\nRaw Model Content:", raw.content);
    throw new AiStageError("INVALID_MODEL_OUTPUT", 502);
  }
}

export async function callJev(
  source: ModelSourceContext,
  extraction: Extraction,
  config: AiConfig = getAiConfig(),
  observe?: ProviderObserver
): Promise<{ classification: JevResult; metadata: ProviderMetadata }> {
  const content = jevContent(source, extraction);
  assertModelInput(content, config, VERIFICATION_PROMPT);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: VERIFICATION_PROMPT },
    { role: "user", content },
  ];

  let raw;
  try {
    raw = await callNvidiaChatCompletions(messages, config.jevModel, config, 0.1, true);
  } catch (error) {
    throw mapProviderError(error);
  }

  const metadata: ProviderMetadata = {
    ids: { runId: raw.id, messageId: raw.id },
    resolvedModel: raw.model,
    usage: {
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
    },
  };

  if (observe) await observe(metadata);

  try {
    const rawContent = raw.content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const rawJson = JSON.parse(rawContent);
    const normalized = normalizeJevOutput(rawJson, raw.model, raw.inputTokens, raw.outputTokens);
    const classification = jevResultSchema.parse(normalized);
    return { classification, metadata };
  } catch (error) {
    console.error("[NVIDIA NIM Verification Error]", error, "\nRaw Model Content:", raw.content);
    throw new AiStageError("INVALID_MODEL_OUTPUT", 502);
  }
}
