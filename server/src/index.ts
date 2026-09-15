import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { apiRouter } from "./routes";

export const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed"));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.get("/health", (_request, response) => {
  return response.json({ data: { status: "ok" } });
});
app.use("/api", apiRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(process.env.PORT ?? 3000);
}
