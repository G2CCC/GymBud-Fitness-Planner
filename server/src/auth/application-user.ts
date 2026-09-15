import { Prisma } from "@prisma/client";
import { db } from "../db";
import { AuthError, type AuthIdentity, type AuthRequestContext } from "./types";

export async function resolveApplicationUser(
  identity: AuthIdentity,
): Promise<AuthRequestContext> {
  const mappedUser = await db.user.findUnique({
    where: { authUserId: identity.providerUserId },
  });

  if (mappedUser) {
    if (mappedUser.email !== identity.email) {
      await db.user.update({
        where: { id: mappedUser.id },
        data: { email: identity.email },
      });
    }

    return toAuthRequestContext(mappedUser.id, identity);
  }

  const emailMatch = await db.user.findUnique({
    where: { email: identity.email },
    select: { id: true, authUserId: true },
  });

  if (emailMatch) {
    throw new AuthError(
      "AUTH_USER_CONFLICT",
      409,
      "This email is already associated with an existing application account.",
    );
  }

  try {
    const createdUser = await db.user.create({
      data: {
        authUserId: identity.providerUserId,
        email: identity.email,
      },
    });

    return toAuthRequestContext(createdUser.id, identity);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const concurrentUser = await db.user.findUnique({
      where: { authUserId: identity.providerUserId },
    });

    if (!concurrentUser) {
      throw new AuthError(
        "AUTH_USER_CONFLICT",
        409,
        "This authenticated identity cannot be linked to an application account.",
      );
    }

    if (concurrentUser.email !== identity.email) {
      await db.user.update({
        where: { id: concurrentUser.id },
        data: { email: identity.email },
      });
    }

    return toAuthRequestContext(concurrentUser.id, identity);
  }
}

function toAuthRequestContext(
  userId: string,
  identity: AuthIdentity,
): AuthRequestContext {
  return {
    userId,
    providerUserId: identity.providerUserId,
    email: identity.email,
  };
}
