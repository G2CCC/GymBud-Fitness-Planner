import type { RequestHandler, Response } from "express";
import { resolveApplicationUser } from "./application-user";
import { createConfiguredAuthVerifier } from "./verifier";
import {
  AuthError,
  type AuthIdentity,
  type AuthRequestContext,
  type AuthVerifier,
} from "./types";

export type { AuthVerifier } from "./types";

type AuthMiddlewareOptions = {
  verifier?: AuthVerifier;
  resolveUser?: (identity: AuthIdentity) => Promise<AuthRequestContext>;
};

export function createAuthMiddleware(
  options: AuthMiddlewareOptions = {},
): RequestHandler {
  const verifier = options.verifier ?? createConfiguredAuthVerifier();
  const resolveUser = options.resolveUser ?? resolveApplicationUser;

  return async (request, response, next) => {
    const authorization = request.header("authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return sendAuthError(
        response,
        new AuthError(
          "AUTH_REQUIRED",
          401,
          "Sign in is required to access this resource.",
        ),
      );
    }

    try {
      const identity = await verifier.verify(token);
      request.auth = await resolveUser(identity);
      return next();
    } catch (error) {
      if (error instanceof AuthError) {
        return sendAuthError(response, error);
      }

      return next(error);
    }
  };
}

export function sendAuthError(response: Response, error: AuthError) {
  return response.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message,
    },
  });
}
