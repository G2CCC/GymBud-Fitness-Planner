import { env } from "../config/env";
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

type OpenAiCompatibleClientOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class OpenAiCompatibleClient implements AiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiCompatibleClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateJson<T>(
    request: AiRequest,
    schema: ZodSchema<T>,
  ): Promise<T> {
    if (!this.options.apiKey) {
      throw new AiClientError(
        "AI_API_KEY is not configured",
        "NOT_CONFIGURED",
      );
    }

    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: request.model || this.options.model,
            messages: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userPrompt },
            ],
            response_format: { type: "json_object" },
          }),
        },
      );
    } catch (error) {
      throw new AiClientError(
        error instanceof Error ? error.message : "AI provider request failed",
        "PROVIDER_ERROR",
      );
    }

    if (!response.ok) {
      throw new AiClientError(
        `AI provider returned HTTP ${response.status}`,
        "PROVIDER_ERROR",
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new AiClientError(
        "AI provider returned no JSON content",
        "INVALID_RESPONSE",
      );
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(content);
    } catch {
      throw new AiClientError(
        "AI provider returned malformed JSON",
        "INVALID_JSON",
      );
    }

    const parsed = schema.safeParse(decoded);
    if (!parsed.success) {
      throw new AiClientError(
        `AI response failed schema validation: ${parsed.error.message}`,
        "INVALID_RESPONSE",
      );
    }

    return parsed.data;
  }
}

export function createConfiguredAiClient(): AiClient {
  return new OpenAiCompatibleClient({
    apiKey: env.aiApiKey,
    baseUrl: env.aiBaseUrl,
    model: env.aiModel,
  });
}
