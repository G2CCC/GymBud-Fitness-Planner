import { describe, expect, it } from "vitest";
import { FakeAuthVerifier } from "../../src/auth/fake-verifier";

describe("fake auth verifier", () => {
  it("rejects an empty access token", async () => {
    const verifier = new FakeAuthVerifier();

    await expect(verifier.verify("")).rejects.toMatchObject({
      code: "AUTH_INVALID",
    });
  });

  it("maps the deterministic test token to its identity", async () => {
    const verifier = new FakeAuthVerifier();

    await expect(verifier.verify("test-token:e2e-user")).resolves.toEqual({
      providerUserId: "test:e2e-user",
      email: "e2e-user@example.test",
    });
  });

  it("rejects tokens outside the deterministic test format", async () => {
    const verifier = new FakeAuthVerifier();

    await expect(verifier.verify("not-a-test-token")).rejects.toMatchObject({
      code: "AUTH_INVALID",
    });
  });
});
