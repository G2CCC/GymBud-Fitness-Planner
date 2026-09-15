import {
  createClient,
  type AuthChangeEvent,
  type Session,
} from "@supabase/supabase-js";
import type { AuthClient } from "./auth-types";

const fakeSessionStorageKey = "gymbud.fake.auth.session";
let activeAuthClient: AuthClient | null = null;

export function createConfiguredAuthClient(): AuthClient {
  const provider = import.meta.env.VITE_AUTH_PROVIDER;

  if (provider === "fake" || import.meta.env.MODE === "test") {
    return createFakeAuthClient(import.meta.env.VITE_TEST_USER_ID);
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for authentication.",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey).auth;
}

export function getAuthClient(): AuthClient {
  if (!activeAuthClient) {
    activeAuthClient = createConfiguredAuthClient();
  }

  return activeAuthClient;
}

export function setAuthClient(client: AuthClient | null): void {
  activeAuthClient = client;
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await getAuthClient().getSession();
  return data.session?.access_token ?? null;
}

function createFakeAuthClient(userId = "e2e-demo-user"): AuthClient {
  let session = readFakeSession();
  const listeners = new Set<
    (event: AuthChangeEvent, nextSession: Session | null) => void
  >();

  const notify = (event: AuthChangeEvent) => {
    for (const listener of listeners) {
      listener(event, session);
    }
  };

  const authenticate = () => {
    session = createFakeSession(userId);
    persistFakeSession(session);
    notify("SIGNED_IN");
    return session;
  };

  return {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (callback) => {
      listeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(callback),
          },
        },
      };
    },
    signInWithPassword: async () => ({
      data: { session: authenticate() },
      error: null,
    }),
    signUp: async () => ({
      data: { session: authenticate() },
      error: null,
    }),
    signOut: async () => {
      session = null;
      persistFakeSession(null);
      notify("SIGNED_OUT");
      return { error: null };
    },
  };
}

function createFakeSession(userId: string): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: `test-token:${userId}`,
    expires_at: now + 3600,
    expires_in: 3600,
    refresh_token: `test-refresh:${userId}`,
    token_type: "bearer",
    user: {
      id: `test:${userId}`,
      aud: "authenticated",
      role: "authenticated",
      email: `${userId}@example.test`,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

function readFakeSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(fakeSessionStorageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Session;
  } catch {
    window.localStorage.removeItem(fakeSessionStorageKey);
    return null;
  }
}

function persistFakeSession(session: Session | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (session) {
    window.localStorage.setItem(fakeSessionStorageKey, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(fakeSessionStorageKey);
  }
}
