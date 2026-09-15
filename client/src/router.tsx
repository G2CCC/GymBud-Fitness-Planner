import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { App } from "./App";
import { RequireAuth } from "./components/auth/RequireAuth";
import { AuthLoadingState } from "./components/auth/AuthLoadingState";
import { AuthPage } from "./pages/auth/AuthPage";
import { LandingPage } from "./pages/landing/LandingPage";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { CalendarPage } from "./pages/calendar/CalendarPage";
import { WorkoutPage } from "./pages/workouts/WorkoutPage";
import { ReviewPage } from "./pages/review/ReviewPage";
import { ProgressPage } from "./pages/progress/ProgressPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { TodayPage } from "./pages/today/TodayPage";

export function LandingRoute() {
  const { state } = useAuth();

  if (state.status === "loading") {
    return <AuthLoadingState />;
  }

  if (state.status === "authenticated") {
    return <Navigate to="/today" replace />;
  }

  return <LandingPage />;
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingRoute /> },
  { path: "/login", element: <AuthPage mode="login" /> },
  { path: "/signup", element: <AuthPage mode="signup" /> },
  {
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      { path: "today", element: <TodayPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "workouts/:workoutId", element: <WorkoutPage /> },
      { path: "review/:cycleId", element: <ReviewPage /> },
      { path: "progress", element: <ProgressPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
]);
