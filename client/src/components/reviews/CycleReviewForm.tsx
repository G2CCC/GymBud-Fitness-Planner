export type CycleReviewFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

/**
 * The review note is deliberately optional. The API sends it to the model
 * for this request, but the raw text is not persisted as user history.
 */
export function CycleReviewForm({
  value,
  onChange,
  onSubmit,
  submitting = false,
}: CycleReviewFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="cycle-review-summary">
        Optional cycle summary
      </label>
      <textarea
        id="cycle-review-summary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Anything you want the AI to consider?"
        rows={5}
      />
      <p>
        This note is optional. GymBud processes it for this review and does not
        save the original text.
      </p>
      <button type="submit" disabled={submitting}>
        {submitting ? "Generating review…" : "Generate cycle review"}
      </button>
    </form>
  );
}
