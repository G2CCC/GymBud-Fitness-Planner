import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { productName } from "@fitness/shared/brand";
import { useAuth } from "../../auth/AuthProvider";
import { AuthLoadingState } from "../../components/auth/AuthLoadingState";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { state, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state.status === "authenticated") {
      navigate("/today", { replace: true });
    }
  }, [navigate, state.status]);

  if (state.status === "loading") {
    return <AuthLoadingState />;
  }

  if (state.status === "authenticated") {
    return null;
  }

  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmationRequired(false);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(normalizedEmail, password);
        navigate("/today", { replace: true });
      } else {
        const result = await signUp(normalizedEmail, password);
        if (result.confirmationRequired) {
          setConfirmationRequired(true);
        } else {
          navigate("/today", { replace: true });
        }
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gymbud-background px-4 py-8 text-gymbud-ink sm:px-6">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border border-gymbud-border bg-gymbud-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <header>
          <Link
            className="focus-ring text-sm font-semibold text-gymbud-muted hover:text-gymbud-ink"
            to="/"
          >
            {productName}
          </Link>
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-gymbud-muted">
            {isLogin ? "Welcome back" : "Start deliberately"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {isLogin ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-gymbud-muted">
            {isLogin
              ? "Return to your training plan and keep the next session clear."
              : "Build a training rhythm that fits your real week."}
          </p>
        </header>

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="email">
            Email
            <input
              autoComplete="email"
              className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-background px-3 font-normal"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="password">
            Password
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="focus-ring min-h-11 rounded-[var(--radius-control)] border border-gymbud-border bg-gymbud-background px-3 font-normal"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-[var(--radius-control)] bg-gymbud-danger/10 px-3 py-3 text-sm text-gymbud-danger" role="alert">
              {error}
            </p>
          ) : null}
          {confirmationRequired ? (
            <p
              className="rounded-[var(--radius-control)] bg-gymbud-accent-soft px-3 py-3 text-sm text-gymbud-ink"
              role="status"
            >
              Check your email to confirm your account, then sign in to begin.
            </p>
          ) : null}

          <button
            className="button-primary focus-ring w-full disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Working…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gymbud-muted">
          {isLogin ? "New to GymBud?" : "Already have an account?"}{" "}
          <Link
            className="focus-ring font-semibold text-gymbud-ink underline decoration-gymbud-accent-strong underline-offset-4"
            to={isLogin ? "/signup" : "/login"}
          >
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
