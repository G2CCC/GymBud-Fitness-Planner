import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NextCycleDraftEditor } from "../../src/components/review/NextCycleDraftEditor";

describe("next-cycle draft editor", () => {
  it("keeps the AI draft unconfirmed until the user explicitly confirms it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <NextCycleDraftEditor
        draft={{
          cycleId: "draft-1",
          title: "Strength foundation",
          focus: "Build consistent strength",
          weeks: 4,
        }}
        onConfirm={onConfirm}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText("Review the AI draft before adding it to your calendar."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /confirm and add to calendar/i }),
    );

    expect(onConfirm).toHaveBeenCalledWith({
      cycleId: "draft-1",
      title: "Strength foundation",
      focus: "Build consistent strength",
      weeks: 4,
    });
  });
});
