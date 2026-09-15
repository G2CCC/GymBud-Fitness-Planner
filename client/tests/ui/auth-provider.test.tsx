import { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "../../src/auth/AuthProvider";
import type { AuthClient } from "../../src/auth/auth-types";

function createSession(accessToken: string): Session {
  return {
    access_token: accessToken,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    refresh_token: "refresh-token",
    token_type: "bearer",
    user: {} as Session["user"],
  };
}

function createFakeAuthClient(options: {
  session?: Session | null;
  signUpSession?: Session | null;
} = {}): AuthClient {
  let session = options.session ?? null;
  const listeners = new Set<Parameters<AuthClient["onAuthStateChange"]>[0]>();
  const signUpSession = options.signUpSession ?? session;

  return {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(callback),
          },
        },
      };
    }),
    signInWithPassword: vi.fn(async () => ({
      data: { session },
      error: null,
    })),
    signUp: vi.fn(async () => {
      session = signUpSession;
      for (const listener of listeners) {
        listener("SIGNED_IN", session);
      }
      return { data: { session }, error: null };
    }),
    signOut: vi.fn(async () => {
      session = null;
      for (const listener of listeners) {
        listener("SIGNED_OUT", null);
      }
      return { error: null };
    }),
  };
}

function AuthStateProbe() {
  const { state } = useAuth();
  return <div role="status">{state.status === "loading" ? "Loading" : state.status === "authenticated" ? "Authenticated" : "Unauthenticated"}</div>;
}

function SignUpProbe({ onResult }: { onResult: (value: boolean) => void }) {
  const { signUp } = useAuth();
  return (
    <button
      type="button"
      onClick={() => {
        void signUp("person@example.com", "password").then((result) => {
          onResult(result.confirmationRequired);
        });
      }}
    >
      Sign up
    </button>
  );
}

function SignInProbe({ onError }: { onError: (value: string) => void }) {
  const { signIn } = useAuth();
  return (
    <button
      type="button"
      onClick={() => {
        void signIn("person@example.com", "password").catch((error: unknown) => {
          onError(error instanceof Error ? error.message : "unknown error");
        });
      }}
    >
      Sign in
    </button>
  );
}

function TestHarness({ client, children }: { client: AuthClient; children: ReactNode }) {
  return <AuthProvider client={client}>{children}</AuthProvider>;
}

describe("AuthProvider", () => {
  it("starts loading and becomes authenticated from the existing session", async () => {
    const client = createFakeAuthClient({ session: createSession("access-token") });

    render(
      <TestHarness client={client}>
        <AuthStateProbe />
      </TestHarness>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText("Authenticated")).toBeInTheDocument();
  });

  it("reports confirmation required when sign-up returns no session", async () => {
    const onResult = vi.fn();
    const client = createFakeAuthClient({ signUpSession: null });

    render(
      <TestHarness client={client}>
        <SignUpProbe onResult={onResult} />
      </TestHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("rejects a sign-in response that does not create a session", async () => {
    const onError = vi.fn();
    const client = createFakeAuthClient({ session: null });

    render(
      <TestHarness client={client}>
        <SignInProbe onError={onError} />
      </TestHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Sign-in did not create a session. Please try again.",
      ),
    );
  });
});
