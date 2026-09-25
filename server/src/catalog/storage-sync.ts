import type { StrengthCatalogSeed } from "@fitness/shared";

export type ImageDownloader = (
  url: string,
) => Promise<{ bytes: Uint8Array; contentType: string }>;

export type ImageUploader = (
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) => Promise<void>;

export type ImageSyncDependencies = {
  download: ImageDownloader;
  upload: ImageUploader;
  exists?: (bucket: string, path: string) => Promise<boolean>;
};

export type ImageSyncFailure = {
  sourceId: string;
  path: string;
  message: string;
};

export type ImageSyncSummary = {
  uploaded: number;
  skipped: number;
  failed: number;
  failures: ImageSyncFailure[];
};

export type ImageSyncOptions = {
  bucket?: string;
  concurrency?: number;
};

type Asset = {
  sourceId: string;
  url: string;
  path: string;
};

export async function syncExerciseImages(
  manifest: readonly StrengthCatalogSeed[],
  dependencies: ImageSyncDependencies,
  options: ImageSyncOptions = {},
): Promise<ImageSyncSummary> {
  const bucket = options.bucket ?? "exercise-images";
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 4));
  const assets: Asset[] = manifest.flatMap((exercise) =>
    exercise.imagePaths.map((path, index) => ({
      sourceId: exercise.sourceId,
      url: exercise.images[index] ?? "",
      path,
    })),
  );

  const results: Array<
    | { status: "uploaded" | "skipped" }
    | { status: "failed"; failure: ImageSyncFailure }
  > = [];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const asset = assets[nextIndex];
      nextIndex += 1;
      if (!asset) return;

      try {
        if (!asset.url) {
          throw new Error("source image URL is missing");
        }
        if (dependencies.exists && (await dependencies.exists(bucket, asset.path))) {
          results.push({ status: "skipped" });
          continue;
        }

        const downloaded = await dependencies.download(asset.url);
        if (downloaded.bytes.byteLength === 0) {
          throw new Error("source image body is empty");
        }
        if (!downloaded.contentType.toLowerCase().startsWith("image/")) {
          throw new Error(`source content type is not an image: ${downloaded.contentType}`);
        }

        await dependencies.upload(
          bucket,
          asset.path,
          downloaded.bytes,
          downloaded.contentType,
        );
        results.push({ status: "uploaded" });
      } catch (error) {
        results.push({
          status: "failed",
          failure: {
            sourceId: asset.sourceId,
            path: asset.path,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, assets.length) }, () => worker()),
  );

  const failureBySource = new Map<string, ImageSyncFailure>();
  for (const result of results) {
    if (result.status === "failed" && !failureBySource.has(result.failure.sourceId)) {
      failureBySource.set(result.failure.sourceId, result.failure);
    }
  }

  return {
    uploaded: results.filter((result) => result.status === "uploaded").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: failureBySource.size,
    failures: [...failureBySource.values()],
  };
}
