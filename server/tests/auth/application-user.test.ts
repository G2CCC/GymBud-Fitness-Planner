import { beforeEach, describe, expect, it, vi } from "vitest";

const userModel = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../../src/db", () => ({
  db: { user: userModel },
}));

import { resolveApplicationUser } from "../../src/auth/application-user";

describe("application user resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a new mapped application user for a new identity", async () => {
    userModel.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    userModel.create.mockResolvedValueOnce({
      id: "app-user-1",
      authUserId: "supabase-user-1",
      email: "person@example.com",
    });

    await expect(
      resolveApplicationUser({
        providerUserId: "supabase-user-1",
        email: "person@example.com",
      }),
    ).resolves.toEqual({
      userId: "app-user-1",
      providerUserId: "supabase-user-1",
      email: "person@example.com",
    });

    expect(userModel.create).toHaveBeenCalledWith({
      data: {
        authUserId: "supabase-user-1",
        email: "person@example.com",
      },
    });
  });

  it("reuses the mapped row and updates only its email", async () => {
    userModel.findUnique.mockResolvedValueOnce({
      id: "app-user-1",
      authUserId: "supabase-user-1",
      email: "old@example.com",
    });
    userModel.update.mockResolvedValueOnce({});

    await expect(
      resolveApplicationUser({
        providerUserId: "supabase-user-1",
        email: "new@example.com",
      }),
    ).resolves.toMatchObject({ userId: "app-user-1" });

    expect(userModel.update).toHaveBeenCalledWith({
      where: { id: "app-user-1" },
      data: { email: "new@example.com" },
    });
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it("rejects email-only linking to an unmapped application row", async () => {
    userModel.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "historical-user", authUserId: null });

    await expect(
      resolveApplicationUser({
        providerUserId: "supabase-user-2",
        email: "person@example.com",
      }),
    ).rejects.toMatchObject({
      code: "AUTH_USER_CONFLICT",
      statusCode: 409,
    });

    expect(userModel.create).not.toHaveBeenCalled();
  });
});
