import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { selectedStrengthExercises } from "../server/src/catalog/data/strength-exercises";
import { syncExerciseImages } from "../server/src/catalog/storage-sync";

// Image synchronization authenticates with the server-only service-role key;
// Supabase Auth configuration is intentionally irrelevant to this command.
process.env.NODE_ENV = "test";
process.env.AUTH_PROVIDER = "fake";
const { env } = await import("../server/src/config/env");

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for catalog:sync-images",
  );
}

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
const summary = await syncExerciseImages(selectedStrengthExercises, {
  upload: async (bucket, path, bytes, contentType) => {
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
  },
  download: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`source image request failed with ${response.status}`);
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "",
    };
  },
}, { bucket: env.exerciseImageBucket });

console.log(
  `Exercise image sync: uploaded=${summary.uploaded} skipped=${summary.skipped} failed=${summary.failed}`,
);
if (summary.failures.length > 0) {
  for (const failure of summary.failures) {
    console.error(`${failure.sourceId} ${failure.path}: ${failure.message}`);
  }
  process.exitCode = 1;
}
