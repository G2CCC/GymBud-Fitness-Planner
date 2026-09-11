import "dotenv/config";

export const env = {
  apiUrl: process.env.API_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL ?? "",
  directUrl: process.env.DIRECT_URL ?? "",
  demoUserId: process.env.DEMO_USER_ID ?? "demo-user",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiBaseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  aiModel: process.env.AI_MODEL ?? "gpt-4o-mini",
};
