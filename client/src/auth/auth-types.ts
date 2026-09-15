import type {
  AuthChangeEvent,
  AuthError as SupabaseAuthError,
  Session,
} from "@supabase/supabase-js";

export type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  session: Session | null;
};

export type AuthResponse = {
  data: { session: Session | null };
  error: SupabaseAuthError | null;
};

export interface AuthClient {
  getSession(): Promise<AuthResponse>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): {
    data: { subscription: { unsubscribe: () => void } };
    error?: SupabaseAuthError | null;
  };
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse>;
  signUp(credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse>;
  signOut(): Promise<{ error: SupabaseAuthError | null }>;
}

export type AuthContextValue = {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  signUp(
    email: string,
    password: string,
  ): Promise<{ confirmationRequired: boolean }>;
  signOut(): Promise<void>;
};
