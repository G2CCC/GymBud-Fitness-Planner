import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { AuthLoadingState } from "./AuthLoadingState";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading") {
    return <AuthLoadingState />;
  }

  if (state.status === "unauthenticated") {
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children;
}
