import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
const workoutDrawer = readFileSync(
  new URL("../../src/components/calendar/WorkoutDetailsDrawer.tsx", import.meta.url),
  "utf8",
);

describe("Ion Matrix design tokens", () => {
  it("uses the dark indigo foundation and violet brand accent", () => {
    expect(tokens).toMatch(/color-scheme:\s*dark/);
    expect(tokens).toMatch(/--color-background:\s*#111328/);
    expect(tokens).toMatch(/--color-surface:\s*#1b1d3d/i);
    expect(tokens).toMatch(/--color-accent:\s*#9b7bff/i);
  });

  it("dims workout details with a dark overlay", () => {
    expect(workoutDrawer).toMatch(/bg-black\/50/);
  });
});
