import { describe, expect, it, vi } from "vitest";
import type { StrengthCatalogSeed } from "@fitness/shared";
import { syncExerciseImages } from "../../src/catalog/storage-sync";

const oneExercise: StrengthCatalogSeed = {
  id: "free-exercise-db-Pushups",
  sourceProvider: "free-exercise-db",
  sourceId: "Pushups",
  sourceCommit: "a859101d633a01c4a1a920d6a8ce41dabba0705f",
  sourceCategory: "strength",
  name: "Pushups",
  description: null,
  equipment: "NONE",
  level: "beginner",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  targetMuscles: ["chest", "triceps"],
  movementPattern: "compound",
  instructions: ["Push away from the floor."],
  images: ["https://example.test/0.jpg", "https://example.test/1.jpg"],
  primaryFocusArea: "CHEST",
  focusAreas: ["CHEST"],
  imagePaths: [
    "free-exercise-db/Pushups/0.jpg",
    "free-exercise-db/Pushups/1.jpg",
  ],
  aiEligible: true,
};

describe("exercise image synchronization", () => {
  it("uploads both source images to the configured bucket path", async () => {
    const fakeUpload = vi.fn().mockResolvedValue(undefined);
    const result = await syncExerciseImages([oneExercise], {
      download: vi
        .fn()
        .mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" }),
      upload: fakeUpload,
    });

    expect(result).toMatchObject({ uploaded: 2, skipped: 0, failed: 0 });
    expect(fakeUpload).toHaveBeenNthCalledWith(
      1,
      "exercise-images",
      "free-exercise-db/Pushups/0.jpg",
      expect.any(Uint8Array),
      "image/jpeg",
    );
  });

  it("reports an unavailable image without aborting other records", async () => {
    const missingExercise = {
      ...oneExercise,
      sourceId: "missing-source-id",
      id: "missing",
      images: ["https://example.test/missing-0.jpg", "https://example.test/missing-1.jpg"],
    };
    const result = await syncExerciseImages([oneExercise, missingExercise], {
      download: vi.fn(async (url: string) => {
        if (url.includes("missing")) {
          throw new Error("not found");
        }
        return { bytes: new Uint8Array([1]), contentType: "image/jpeg" };
      }),
      upload: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.failed).toBe(1);
    expect(result.failures[0]?.sourceId).toBe("missing-source-id");
    expect(result.uploaded).toBe(2);
  });

  it("skips assets reported as already present", async () => {
    const result = await syncExerciseImages([oneExercise], {
      download: vi.fn(),
      upload: vi.fn(),
      exists: vi.fn().mockResolvedValue(true),
    });

    expect(result).toMatchObject({ uploaded: 0, skipped: 2, failed: 0 });
  });
});
