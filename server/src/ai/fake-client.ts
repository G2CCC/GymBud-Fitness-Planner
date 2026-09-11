import {
  AiClientError,
  type AiClient,
  type AiRequest,
} from "./client";
import type { ZodSchema } from "zod";

export type FakeAiResponse =
  | unknown
  | ((request: AiRequest) => unknown | Promise<unknown>);

export class FakeAiClient implements AiClient {
  readonly requests: AiRequest[] = [];

  constructor(private readonly response: FakeAiResponse) {}

  async generateJson<T>(
    request: AiRequest,
    schema: ZodSchema<T>,
  ): Promise<T> {
    this.requests.push(request);

    const raw =
      typeof this.response === "function"
        ? await this.response(request)
        : this.response;

    let decoded = raw;
    if (typeof raw === "string") {
      try {
        decoded = JSON.parse(raw);
      } catch {
        throw new AiClientError(
          "Fake AI client returned malformed JSON",
          "INVALID_JSON",
        );
      }
    }

    const parsed = schema.safeParse(decoded);
    if (!parsed.success) {
      throw new AiClientError(
        `Fake AI response failed schema validation: ${parsed.error.message}`,
        "INVALID_RESPONSE",
      );
    }

    return parsed.data;
  }
}
