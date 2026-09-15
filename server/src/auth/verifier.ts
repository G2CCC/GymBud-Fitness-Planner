import { env } from "../config/env";
import { FakeAuthVerifier } from "./fake-verifier";
import { SupabaseAuthVerifier } from "./supabase-verifier";
import type { AuthVerifier } from "./types";

export function createConfiguredAuthVerifier(): AuthVerifier {
  if (env.authProvider === "fake") {
    return new FakeAuthVerifier();
  }

  return new SupabaseAuthVerifier();
}
