import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { CalendarPage } from "./pages/calendar/CalendarPage";
import { WorkoutPage } from "./pages/workouts/WorkoutPage";
import { ReviewPage } from "./pages/review/ReviewPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <OnboardingPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "workouts/:workoutId", element: <WorkoutPage /> },
      { path: "review/:cycleId", element: <ReviewPage /> },
    ],
  },
]);
