import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { AuthError, type AuthIdentity, type AuthVerifier } from "./types";

export type SupabaseAuthClient = {
  auth: {
    getUser(accessToken: string): Promise<{
      data: {
        user: { id: string; email?: string } | null;
      };
      error: unknown;
    }>;
  };
};

export class SupabaseAuthVerifier implements AuthVerifier {
  private readonly client: SupabaseAuthClient;

  constructor(
    client: SupabaseAuthClient = createClient(
      env.supabaseUrl,
      env.supabaseAnonKey,
    ),
  ) {
    this.client = client;
  }

  async verify(accessToken: string): Promise<AuthIdentity> {
    if (!accessToken.trim()) {
      throw new AuthError(
        "AUTH_INVALID",
        401,
        "The authentication token is invalid or expired.",
      );
    }

    const { data, error } = await this.client.auth.getUser(accessToken);
    const email = data.user?.email?.trim();

    if (error || !data.user?.id || !email) {
      throw new AuthError(
        "AUTH_INVALID",
        401,
        "The authentication token is invalid or expired.",
      );
    }

    return {
      providerUserId: data.user.id,
      email,
    };
  }
}
