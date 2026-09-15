import type { Request } from "express";

export type AuthErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "AUTH_USER_CONFLICT";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly statusCode: 401 | 409,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthIdentity = {
  providerUserId: string;
  email: string;
};

export type AuthRequestContext = AuthIdentity & {
  userId: string;
};

export interface AuthVerifier {
  verify(accessToken: string): Promise<AuthIdentity>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthRequestContext;
    }
  }
}

export function getRequestAuth(request: Request): AuthRequestContext {
  if (!request.auth) {
    throw new Error("Authenticated request context is missing.");
  }

  return request.auth;
}
