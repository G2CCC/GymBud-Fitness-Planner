import express from "express";
import cors from "cors";

export const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  app.listen(process.env.PORT ?? 3000);
}
