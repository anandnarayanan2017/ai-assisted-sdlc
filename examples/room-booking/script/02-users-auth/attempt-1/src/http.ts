import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Postgres SQLSTATE of a driver error, if any. */
export function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation failed", issues: err.issues });
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "malformed JSON body" });
  } else {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
};
