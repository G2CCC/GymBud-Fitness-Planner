import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProfile } from "../../src/api/client";
import { setAuthClient } from "../../src/auth/client";
import type { AuthClient } from "../../src/auth/auth-types";

describe("authenticated API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setAuthClient(null);
  });

  it("sends the current access token as a bearer header", async () => {
    const authClient = {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "access-token",
          },
        },
        error: null,
      } as never)),
    } as AuthClient;
    setAuthClient(authClient);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null }), { status: 200 }),
    );

    await getProfile();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers;
    expect(new Headers(headers).get("Authorization")).toBe(
      "Bearer access-token",
    );
  });

  it("does not invent an authorization header without a session", async () => {
    const authClient = {
      getSession: vi.fn(async () => ({
        data: { session: null },
        error: null,
      })),
    } as AuthClient;
    setAuthClient(authClient);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: null }), { status: 200 }),
    );

    await getProfile();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = (init as RequestInit | undefined)?.headers;
    expect(new Headers(headers).get("Authorization")).toBeNull();
  });
});
