import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

export type AuthProvider = "supabase" | "fake";

export type AppEnv = {
  nodeEnv: string;
  apiUrl: string;
  databaseUrl: string;
  directUrl: string;
  authProvider: AuthProvider;
  supabaseUrl: string;
  supabaseAnonKey: string;
  corsOrigins: string[];
  e2eAuthEnabled: boolean;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  aiProvider: string;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = source.NODE_ENV ?? "development";
  const authProviderValue =
    source.AUTH_PROVIDER ?? (nodeEnv === "test" ? "fake" : "supabase");
  const authProvider = authProviderValue.toLowerCase();

  if (authProvider !== "supabase" && authProvider !== "fake") {
    throw new Error(
      `AUTH_PROVIDER must be either supabase or fake, received ${authProviderValue}.`,
    );
  }

  const e2eAuthEnabled = source.E2E_AUTH_ENABLED?.toLowerCase() === "true";

  if (authProvider === "fake" && nodeEnv === "production") {
    throw new Error("Fake authentication cannot be enabled in production.");
  }

  if (authProvider === "fake" && nodeEnv !== "test" && !e2eAuthEnabled) {
    throw new Error(
      "Fake authentication requires NODE_ENV=test or E2E_AUTH_ENABLED=true.",
    );
  }

  const supabaseUrl = source.SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = source.SUPABASE_ANON_KEY?.trim() ?? "";

  if (authProvider === "supabase" && (!supabaseUrl || !supabaseAnonKey)) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY are required when AUTH_PROVIDER=supabase.",
    );
  }

  const configuredCorsOrigins = source.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigins =
    configuredCorsOrigins && configuredCorsOrigins.length > 0
      ? configuredCorsOrigins
      : nodeEnv === "production"
        ? []
        : ["http://localhost:5173"];

  return {
    nodeEnv,
    apiUrl: source.API_URL ?? "http://localhost:3000",
    databaseUrl: source.DATABASE_URL ?? "",
    directUrl: source.DIRECT_URL ?? "",
    authProvider,
    supabaseUrl,
    supabaseAnonKey,
    corsOrigins,
    e2eAuthEnabled,
    aiApiKey: source.AI_API_KEY ?? "",
    aiBaseUrl: source.AI_BASE_URL ?? "https://api.openai.com/v1",
    aiModel: source.AI_MODEL ?? "gpt-4o-mini",
    aiProvider: source.AI_PROVIDER ?? "openai",
  };
}

export const env = loadEnv();
