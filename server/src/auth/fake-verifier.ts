import { AuthError, type AuthIdentity, type AuthVerifier } from "./types";

const testTokenPattern = /^test-token:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export class FakeAuthVerifier implements AuthVerifier {
  async verify(accessToken: string): Promise<AuthIdentity> {
    const match = testTokenPattern.exec(accessToken);

    if (!match?.[1]) {
      throw new AuthError(
        "AUTH_INVALID",
        401,
        "The authentication token is invalid or expired.",
      );
    }

    const slug = match[1];
    return {
      providerUserId: `test:${slug}`,
      email: `${slug}@example.test`,
    };
  }
}
