import { env } from "../config/env";
import { createDeterministicFakeAiClient } from "./fake-client";
import {
  AiClientError,
  type AiClient,
  type AiRequest,
} from "./types";
import type { ZodSchema } from "zod";

export { AiClientError } from "./types";
export type {
  AiClient,
  AiClientErrorCode,
  AiRequest,
} from "./types";

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
  if (env.aiProvider === "fake") {
    return createDeterministicFakeAiClient();
  }

  return new OpenAiCompatibleClient({
    apiKey: env.aiApiKey,
    baseUrl: env.aiBaseUrl,
    model: env.aiModel,
  });
}
