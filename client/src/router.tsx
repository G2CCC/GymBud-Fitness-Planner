import { createBrowserRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { CalendarPage } from "./pages/calendar/CalendarPage";
import { WorkoutPage } from "./pages/workouts/WorkoutPage";
import { ReviewPage } from "./pages/review/ReviewPage";
import { ProgressPage } from "./pages/progress/ProgressPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { TodayPage } from "./pages/today/TodayPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
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
