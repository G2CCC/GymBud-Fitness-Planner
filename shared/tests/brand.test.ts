import { describe, expect, it } from "vitest";
import { productName, productShortName } from "@fitness/shared/brand";

describe("GymBud brand", () => {
  it("exposes the product name shared by web and future mobile clients", () => {
    expect(productName).toBe("GymBud Fitness Planner");
    expect(productShortName).toBe("GymBud");
  });
});
