import { AiClientError, type AiClient, type AiRequest } from "./types";
import type { ZodSchema } from "zod";

function parsePrompt(prompt: AiRequest): Record<string, any> {
  try {
    const decoded: unknown = JSON.parse(prompt.userPrompt);
    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? (decoded as Record<string, any>)
      : {};
  } catch {
    return {};
  }
}

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

/**
 * Deterministic responses for local E2E runs. This never runs unless the
 * server is explicitly started with AI_PROVIDER=fake.
 */
export function createDeterministicFakeAiClient(): AiClient {
  return new FakeAiClient((request: AiRequest) => {
    const feature = request.metadata?.feature;

    if (feature === "four-week-plan") {
      const context = parsePrompt(request);
      const cycle = context.cycle ?? {};
      const profile = context.profile ?? {};
      return {
        workouts: [
          {
            scheduledDate: cycle.startDate,
            activityType: "STRENGTH",
            durationMinutes: profile.sessionDurationMinutes ?? 60,
            exercises: [
              {
                exerciseId: "system-push-up",
                sortOrder: 1,
                restSeconds: 60,
                sets: [{ setNumber: 1, targetReps: 10 }],
              },
            ],
          },
        ],
      };
    }

    if (feature === "cycle-review" || feature === "four-cycle-review") {
      return {
        processedSummary: "The actual training volume is ready for review.",
        conclusions: {
          status: "CONTINUE",
          keyFindings: ["Actual training volume was recorded."],
          recommendations: ["Continue with a manageable next cycle."],
        },
      };
    }

    if (feature === "exercise-replacement") {
      const context = parsePrompt(request);
      const candidate = context.candidatePool?.[0];
      return {
        replacements: candidate
          ? [
              {
                exerciseId: candidate.id,
                reason: "The candidate is legal for the workout.",
                sets: [{ setNumber: 1, targetReps: 10 }],
              },
            ]
          : [],
      };
    }

    if (feature === "weight-recommendation") {
      return {
        recommendedWeight: 10,
        weightUnit: "KG",
        reason: "Use a conservative starting weight for the local test.",
        confidence: "low",
      };
    }

    if (feature === "exercise-extraction") {
      return {
        name: "Test bodyweight exercise",
        description: "A deterministic bodyweight exercise for local tests.",
        equipment: "NONE",
        targetMuscles: ["FULL_BODY"],
        movementPattern: "GENERAL",
      };
    }

    return {};
  });
}
