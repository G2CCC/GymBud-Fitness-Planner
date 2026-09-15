import type { ZodSchema } from "zod";

export type AiRequest = {
  model: string;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  metadata?: Record<string, string>;
};

export interface AiClient {
  generateJson<T>(request: AiRequest, schema: ZodSchema<T>): Promise<T>;
}

export type AiClientErrorCode =
  | "NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "INVALID_JSON"
  | "INVALID_RESPONSE";

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code: AiClientErrorCode,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}
