import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../../src/components/onboarding/ProfileForm";

describe("onboarding profile form", () => {
  it("submits optional body context with the training profile", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ProfileForm onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText(/gender/i), "FEMALE");
    await user.type(screen.getByLabelText(/^Age/i), "27");
    await user.type(screen.getByLabelText(/Height \(cm\)/i), "178");
    await user.type(screen.getByLabelText(/Body weight \(kg\)/i), "82");
    await user.click(
      screen.getByRole("button", { name: /save and open calendar/i }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: "FEMALE",
        age: 27,
        heightCm: 178,
        weightKg: 82,
      }),
    );
  });
});
