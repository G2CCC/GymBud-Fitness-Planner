import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Supabase is a remote database. Keep interactive transactions atomic, but
// allow enough time for a multi-step workout write to cross the network.
export const prismaTransactionOptions = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    transactionOptions: prismaTransactionOptions,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
