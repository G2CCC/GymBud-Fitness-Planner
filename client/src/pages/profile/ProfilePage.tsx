import { useEffect, useState, type ReactNode } from "react";
import type { ProfileInput } from "@fitness/shared";
import { getProfile, saveProfile } from "../../api/client";
import type { ApiProfile } from "../../api/contracts";
import { ProfileForm } from "../../components/onboarding/ProfileForm";

export function ProfilePage() {
  const [profile, setProfile] = useState<ProfileInput | undefined>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const result = await getProfile();
      setProfile(result ? toProfileInput(result) : undefined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handleSubmit(value: ProfileInput) {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await saveProfile(value);
      setProfile(toProfileInput(saved));
      setSuccess("Profile saved. Future AI plans can use this context.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save your profile.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <ProfileMessage message="Loading your profile…" />;
  }

  if (error && !profile) {
    return (
      <ProfileMessage
        message={error}
        isError
        action={
          <button
            type="button"
            className="focus-ring rounded-[var(--radius-control)] bg-gymbud-accent-strong px-4 py-3 text-sm font-semibold text-white"
            onClick={() => void loadProfile()}
          >
            Try again
          </button>
        }
      />
    );
  }

  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-6 sm:px-8">
      {success ? (
        <p role="status" className="rounded-[var(--radius-control)] bg-gymbud-accent-soft p-3 text-sm text-gymbud-ink">
          {success}
        </p>
      ) : null}
      <ProfileForm
        initialValue={profile}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
        title="Profile"
        heading="Your planning profile."
        description="Keep your planning context up to date. These values are used as optional context when GymBud generates a plan."
        submitLabel="Save profile"
      />
    </main>
  );
}

function toProfileInput(profile: ApiProfile): ProfileInput {
  return {
    ...profile,
    secondaryOutcome: profile.secondaryOutcome ?? undefined,
  };
}

function ProfileMessage({
  message,
  action,
  isError = false,
}: {
  message: string;
  action?: ReactNode;
  isError?: boolean;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-2xl content-center gap-4 px-4 py-8 text-center">
      <p className={isError ? "text-gymbud-danger" : "text-gymbud-muted"}>
        {message}
      </p>
      {action}
    </main>
  );
}
