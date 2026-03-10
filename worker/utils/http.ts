import type { Context } from "hono";

export const badRequest = (c: Context, message: string, details?: unknown) =>
  c.json(
    {
      error: message,
      details
    },
    400
  );

export const notFound = (c: Context, message = "Not found") =>
  c.json(
    {
      error: message
    },
    404
  );

export const unauthorized = (c: Context, message = "Unauthorized") =>
  c.json(
    {
      error: message
    },
    401
  );

export const conflict = (c: Context, message: string, details?: unknown) =>
  c.json(
    {
      error: message,
      details
    },
    409
  );