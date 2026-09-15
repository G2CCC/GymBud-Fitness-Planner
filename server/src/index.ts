import express from "express";
import cors from "cors";
import { apiRouter } from "./routes";

export const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.get("/health", (_request, response) => {
  return response.json({ data: { status: "ok" } });
});
app.use("/api", apiRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(process.env.PORT ?? 3000);
}
