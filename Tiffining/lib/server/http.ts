import "server-only";

import { unstable_rethrow } from "next/navigation";
import { MongoNetworkError, MongoServerSelectionError, MongoOperationTimeoutError } from "mongodb";
import { z } from "zod";
import { AppError, type Result } from "@/lib/contracts/common";
import { getAppOrigin } from "@/lib/server/env";
import { captureSafeBackendError } from "@/lib/server/telemetry";
import { RateLimitError } from "@/lib/server/rate-limit";

export const MAX_BODY_BYTES = 256 * 1024;
export const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export function assertTrustedOrigin(requestHeaders: Headers): void {
  if (requestHeaders.get("origin") !== getAppOrigin()) {
    throw new AppError("UNTRUSTED_ORIGIN", "A trusted request origin is required.", 403);
  }
}

export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
  }
  if (!request.body) throw new AppError("MALFORMED_JSON", "A JSON object is required.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function readBoundedJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Use application/json.", 415);
  }
  const body = await readBoundedBody(request, maxBytes);
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError("MALFORMED_JSON", "A valid JSON object is required.", 400);
  }
}

export function getErrorEnvelope(error: unknown, requestId: string): { status: number; result: Result<never>; retryAfter?: number } {
  unstable_rethrow(error);
  captureSafeBackendError(error, requestId);
  if (error instanceof AppError) {
    return {
      status: error.status,
      result: { ok: false, error: { code: error.code, message: error.message, retryable: error.retryable }, meta: { requestId } },
      ...(error instanceof RateLimitError ? { retryAfter: error.retryAfter } : {}),
    };
  }
  if (error instanceof z.ZodError) {
    return {
      status: 422,
      result: { ok: false, error: { code: "VALIDATION_FAILED", message: "Input validation failed.", retryable: false }, meta: { requestId } },
    };
  }
  const unavailable = error instanceof MongoNetworkError || error instanceof MongoServerSelectionError || error instanceof MongoOperationTimeoutError;
  console.error("backend_request_failed", { requestId, category: unavailable ? "dependency" : "unexpected" });
  return {
    status: unavailable ? 503 : 500,
    result: { ok: false, error: { code: unavailable ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR", message: unavailable ? "Service temporarily unavailable." : "An unexpected error occurred.", retryable: unavailable }, meta: { requestId } },
  };
}

export function errorResponse(error: unknown, requestId: string): Response {
  const { status, result, retryAfter } = getErrorEnvelope(error, requestId);
  return Response.json(result, { status, headers: { ...privateHeaders, ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });
}
