import { describe, expect, it, vi } from "vitest";
import {
  SupabaseAuthVerifier,
  type SupabaseAuthClient,
} from "../../src/auth/supabase-verifier";

function createClient(result: Awaited<ReturnType<SupabaseAuthClient["auth"]["getUser"]>>): SupabaseAuthClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(result),
    },
  };
}

describe("Supabase auth verifier", () => {
  it("returns the provider identity from Supabase Auth", async () => {
    const client = createClient({
      data: {
        user: { id: "supabase-user-1", email: "person@example.com" },
      },
      error: null,
    });
    const verifier = new SupabaseAuthVerifier(client);

    await expect(verifier.verify("access-token")).resolves.toEqual({
      providerUserId: "supabase-user-1",
      email: "person@example.com",
    });
    expect(client.auth.getUser).toHaveBeenCalledWith("access-token");
  });

  it("rejects a Supabase user without an email", async () => {
    const verifier = new SupabaseAuthVerifier(
      createClient({
        data: { user: { id: "supabase-user-1" } },
        error: null,
      }),
    );

    await expect(verifier.verify("access-token")).rejects.toMatchObject({
      code: "AUTH_INVALID",
    });
  });
});
