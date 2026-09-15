import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAuthClient, setAuthClient } from "./client";
import type {
  AuthClient,
  AuthContextValue,
  AuthState,
} from "./auth-types";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  client,
}: {
  children: ReactNode;
  client?: AuthClient;
}) {
  const authClient = useMemo(
    () => client ?? getAuthClient(),
    [client],
  );
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
  });

  setAuthClient(authClient);

  useEffect(() => {
    let mounted = true;
    const subscriptionResult = authClient.onAuthStateChange((_event, session) => {
      if (mounted) {
        setState(toAuthState(session));
      }
    });

    void authClient
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setState(toAuthState(data.session));
        }
      })
      .catch(() => {
        if (mounted) {
          setState(toAuthState(null));
        }
      });

    return () => {
      mounted = false;
      subscriptionResult.data.subscription.unsubscribe();
    };
  }, [authClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await authClient.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw toPublicAuthError(error.message);
      }

      if (!data.session) {
        setState(toAuthState(null));
        throw new Error("Sign-in did not create a session. Please try again.");
      }

      setState(toAuthState(data.session));
    },
    [authClient],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await authClient.signUp({ email, password });

      if (error) {
        throw toPublicAuthError(error.message);
      }

      setState(toAuthState(data.session));
      return { confirmationRequired: data.session === null };
    },
    [authClient],
  );

  const signOut = useCallback(async () => {
    const { error } = await authClient.signOut();

    if (error) {
      throw toPublicAuthError(error.message);
    }

    setState({ status: "unauthenticated", session: null });
  }, [authClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signUp, signOut }),
    [signIn, signOut, signUp, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}

function toAuthState(session: AuthState["session"]): AuthState {
  return {
    status: session ? "authenticated" : "unauthenticated",
    session,
  };
}

function toPublicAuthError(message: string): Error {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return new Error("The email or password is incorrect.");
  }

  if (normalized.includes("already registered")) {
    return new Error("An account with this email already exists.");
  }

  if (normalized.includes("database") || normalized.includes("token")) {
    return new Error("Authentication could not be completed. Please try again.");
  }

  return new Error(message || "Authentication could not be completed. Please try again.");
}
