import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProfileInput } from "@fitness/shared";
import { createCycleDraft, getProfile, saveProfile } from "../../api/client";
import { ProfileForm } from "../../components/onboarding/ProfileForm";

function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileInput | undefined>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getProfile()
      .then((result) => {
        if (active && result) {
          setProfile({
            ...result,
            secondaryOutcome: result.secondaryOutcome ?? undefined,
          });
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
      await createCycleDraft(value, systemTimezone());
      navigate("/calendar");
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

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl content-center px-4 py-8 sm:px-8">
      {loading ? (
        <p className="rounded-[var(--radius-card)] bg-gymbud-surface p-6 text-sm text-gymbud-muted">
          Loading your setup…
        </p>
      ) : (
        <ProfileForm
          initialValue={profile}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      )}
    </main>
  );
}
