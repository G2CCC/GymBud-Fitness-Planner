import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createAuthMiddleware,
  type AuthVerifier,
} from "../../src/auth/middleware";
import { FakeAuthVerifier } from "../../src/auth/fake-verifier";
import { getAuthenticatedUserId } from "../../src/current-user";

const identity = {
  providerUserId: "test:e2e-user",
  email: "e2e-user@example.test",
};

const context = {
  userId: "app-user-1",
  ...identity,
};

function createTestApp(middleware: RequestHandler) {
  const app = express();
  app.use(middleware);
  app.get("/protected", (request, response) => {
    return response.json({
      data: { userId: getAuthenticatedUserId(request) },
    });
  });
  return app;
}

describe("authentication middleware", () => {
  const verifier: AuthVerifier = {
    verify: async (token) => {
      if (token !== "test-token:e2e-user") {
        throw new Error("unexpected token");
      }
      return identity;
    },
  };

  it("returns 401 when the authorization header is missing", async () => {
    const app = createTestApp(
      createAuthMiddleware({
        verifier,
        resolveUser: async () => context,
      }),
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("attaches the mapped application user to a valid request", async () => {
    const app = createTestApp(
      createAuthMiddleware({
        verifier,
        resolveUser: async () => context,
      }),
    );

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer test-token:e2e-user");

    expect(response.status).toBe(200);
    expect(response.body.data.userId).toBe("app-user-1");
  });

  it("returns 401 when the bearer token verifier rejects the token", async () => {
    const app = createTestApp(
      createAuthMiddleware({ verifier: new FakeAuthVerifier() }),
    );

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_INVALID");
  });
});
