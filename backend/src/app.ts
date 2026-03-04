import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "./lib/env.js";
import { analysisRouter } from "./routes/analysisRoutes.js";
import { usageRouter } from "./routes/usageRoutes.js";

export const app = express();

const configuredOrigins = env.FRONTEND_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV === "development" && localhostPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
    methods: ["GET", "POST"]
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", analysisRouter);
app.use("/api", usageRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "요청 본문 형식이 올바르지 않습니다.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  const message = error instanceof Error ? error.message : "서버 내부 오류가 발생했습니다.";
  console.error(error);

  res.status(500).json({
    error: message
  });
});
