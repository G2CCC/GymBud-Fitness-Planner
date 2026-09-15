import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProfileInput } from "@fitness/shared";
import {
  activateCycle,
  confirmInitialCyclePlan,
  createCycleDraft,
  generateInitialCyclePlan,
  getCurrentCycle,
  getProfile,
  saveProfile,
} from "../../api/client";
import type { ApiPlanDraft } from "../../api/contracts";
import { InitialPlanDraftEditor } from "../../components/onboarding/InitialPlanDraftEditor";
import { PlanChoice } from "../../components/onboarding/PlanChoice";
import { ProfileForm } from "../../components/onboarding/ProfileForm";

function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileInput | undefined>();
  const [draftCycleId, setDraftCycleId] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState<ApiPlanDraft | null>(null);
  const [step, setStep] = useState<"profile" | "choice" | "ai-draft">(
    "profile",
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getProfile(), getCurrentCycle()])
      .then(([result, currentCycle]) => {
        if (!active) {
          return;
        }

        if (result) {
          setProfile({
            ...result,
            secondaryOutcome: result.secondaryOutcome ?? undefined,
          });
        }

        if (currentCycle?.status === "DRAFT") {
          setDraftCycleId(currentCycle.id);
          setStep("choice");
        } else if (currentCycle?.status === "ACTIVE") {
          navigate("/calendar", { replace: true });
        }
      })
      .catch(() => {
        if (active) {
          setError("We could not load your current setup.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(value: ProfileInput) {
    setSubmitting(true);
    setError(null);

    try {
      await saveProfile(value);
      const currentCycle = await getCurrentCycle();

      if (currentCycle?.status === "ACTIVE") {
        navigate("/calendar");
        return;
      }

      const draft =
        currentCycle?.status === "DRAFT"
          ? currentCycle
          : await createCycleDraft(value, systemTimezone());

      setDraftCycleId(draft.id);
      setStep("choice");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not create your training cycle.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualPlanChoice() {
    if (!draftCycleId) {
      setError("Your draft cycle is missing. Please save your setup again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await activateCycle(draftCycleId, systemTimezone());
      navigate("/calendar");
    } catch (choiceError) {
      setError(
        choiceError instanceof Error
          ? choiceError.message
          : "We could not activate your manual plan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAiPlanChoice() {
    if (!draftCycleId) {
      setError("Your draft cycle is missing. Please save your setup again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      setPlanDraft(await generateInitialCyclePlan(draftCycleId));
      setStep("ai-draft");
    } catch (choiceError) {
      setError(
        choiceError instanceof Error
          ? choiceError.message
          : "We could not generate an AI plan.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAiPlanConfirm(plan: ApiPlanDraft) {
    if (!draftCycleId) {
      setError("Your draft cycle is missing. Please save your setup again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await confirmInitialCyclePlan(draftCycleId, plan);
      navigate("/calendar");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not add the AI plan to your calendar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl content-center px-4 py-8 sm:px-8">
      {step !== "profile" && error ? (
        <p
          role="alert"
          className="mb-4 rounded-[var(--radius-control)] bg-gymbud-danger/10 p-3 text-sm font-medium text-gymbud-danger"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="rounded-[var(--radius-card)] bg-gymbud-surface p-6 text-sm text-gymbud-muted">
          Loading your setup…
        </p>
      ) : step === "profile" ? (
        <ProfileForm
          initialValue={profile}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      ) : step === "choice" ? (
        <PlanChoice
          onChooseManual={handleManualPlanChoice}
          onChooseAi={handleAiPlanChoice}
          submitting={submitting}
        />
      ) : planDraft ? (
        <InitialPlanDraftEditor
          plan={planDraft}
          onConfirm={handleAiPlanConfirm}
          submitting={submitting}
        />
      ) : null}
    </main>
  );
}
