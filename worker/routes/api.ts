import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  bookFilterSchema,
  bookPayloadSchema,
  createStaffUserSchema,
  duplicateCheckSchema,
  isbnLookupSchema,
  loanRequestDecisionSchema,
  loginSchema,
  loanCreateSchema,
  loanReturnSchema,
  ocrExtractSchema,
  publicBorrowRequestCreateSchema,
  publicReviewCreateSchema,
  settingsSchema
} from "@shared/schemas";
import type { AppBindings } from "../env";
import { getDb } from "../db/client";
import { activityLogs } from "../db/schema";
import {
  createBook,
  getBookById,
  listBooks,
  listLibraryOptions,
  restoreBook,
  updateBook,
  archiveBook,
  deleteBookPermanently,
  getPublicBookByCode,
  getPublicCatalogSummary,
  listPublicBooks
} from "../services/bookService";
import { createStaffUser, listStaffUsers, loginWithPassword, logoutByToken, resolveAuthUser } from "../services/authService";
import { getDashboardStats } from "../services/dashboardService";
import { findDuplicateMatches } from "../services/duplicateService";
import { exportBooksCsv, exportLoansCsv } from "../services/exportService";
import { storeCoverImage } from "../services/imageService";
import { lookupIsbn } from "../services/isbnService";
import { createLoan, listLoans, LoanConflictError, returnLoan } from "../services/loanService";
import { createPublicLoanRequest, decideLoanRequest, listLoanRequests } from "../services/loanRequestService";
import { extractMetadataFromImage } from "../services/ocrService";
import { addPublicReview, getPublicReviewSummaryByCode } from "../services/reviewService";
import { getSettings, updateSettings } from "../services/settingsService";
import { badRequest, conflict, notFound, unauthorized } from "../utils/http";

const parseBookId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const requireStaff = async (c: any, next: () => Promise<void>) => {
  const db = getDb(c.env);
  const user = await resolveAuthUser(db, c.env, c.req.raw, c.req.query("token"));
  if (!user) {
    return unauthorized(c, "Please login first.");
  }
  c.set("authUser", user);
  await next();
};

const requireAdminRole = async (c: any, next: () => Promise<void>) => {
  const user = c.get("authUser");
  if (!user || user.role !== "admin") {
    return unauthorized(c, "Admin permission required.");
  }
  await next();
};

const imageUploadSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/")
});

export const apiRouter = new Hono<AppBindings>();

apiRouter.get("/health", (c) =>
  c.json({
    ok: true,
    ts: new Date().toISOString()
  })
);

apiRouter.get("/public/books", async (c) => {
  const db = getDb(c.env);
  const result = await listPublicBooks(db, {
    search: c.req.query("search") ?? undefined,
    location: c.req.query("location") ?? undefined,
    category: c.req.query("category") ?? undefined,
    language: c.req.query("language") ?? undefined,
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : 80,
    offset: c.req.query("offset") ? Number(c.req.query("offset")) : 0
  });

  return c.json(result);
});

apiRouter.get("/public/books/:shortCode", async (c) => {
  const db = getDb(c.env);
  const shortCode = c.req.param("shortCode");
  const authUser = await resolveAuthUser(db, c.env, c.req.raw, c.req.query("token"));
  const canViewPrivateContact = Boolean(authUser);

  const book = await getPublicBookByCode(db, shortCode, {
    includePrivatePhone: canViewPrivateContact
  });
  if (!book) {
    return notFound(c, "Public book not found");
  }

  const reviews = await getPublicReviewSummaryByCode(db, shortCode, {
    includePrivatePhone: canViewPrivateContact
  });

  return c.json({
    book,
    canViewPrivateContact,
    averageRating: reviews?.averageRating ?? 0,
    ratingCount: reviews?.ratingCount ?? 0,
    reviews: reviews?.reviews ?? []
  });
});

apiRouter.get("/public/summary", async (c) => {
  const db = getDb(c.env);
  const summary = await getPublicCatalogSummary(db);
  return c.json(summary);
});

apiRouter.get("/public/books/:shortCode/reviews", async (c) => {
  const db = getDb(c.env);
  const authUser = await resolveAuthUser(db, c.env, c.req.raw, c.req.query("token"));
  const summary = await getPublicReviewSummaryByCode(db, c.req.param("shortCode"), {
    includePrivatePhone: Boolean(authUser)
  });
  if (!summary) {
    return notFound(c, "Public book not found");
  }

  return c.json(summary);
});

apiRouter.post(
  "/public/books/:shortCode/borrow-requests",
  zValidator("json", publicBorrowRequestCreateSchema),
  async (c) => {
    const db = getDb(c.env);
    const payload = c.req.valid("json");

    try {
      const request = await createPublicLoanRequest(db, c.req.param("shortCode"), payload);
      if (!request) {
        return notFound(c, "Public book not found");
      }

      return c.json({ request }, 201);
    } catch (error) {
      return badRequest(c, error instanceof Error ? error.message : "Could not create borrow request");
    }
  }
);

apiRouter.post("/public/books/:shortCode/reviews", zValidator("json", publicReviewCreateSchema), async (c) => {
  const db = getDb(c.env);
  const payload = c.req.valid("json");
  const summary = await addPublicReview(db, c.req.param("shortCode"), payload);
  if (!summary) {
    return notFound(c, "Public book not found");
  }

  return c.json(summary, 201);
});

apiRouter.post("/auth/login", zValidator("json", loginSchema), async (c) => {
  const db = getDb(c.env);
  const payload = c.req.valid("json");

  try {
    const session = await loginWithPassword(db, payload);
    if (!session) {
      return unauthorized(c, "Invalid username or password.");
    }

    return c.json(session);
  } catch (error) {
    return badRequest(c, error instanceof Error ? error.message : "Login failed.");
  }
});

apiRouter.get("/auth/me", requireStaff, async (c) => {
  return c.json({
    user: c.get("authUser")
  });
});

apiRouter.post("/auth/logout", requireStaff, async (c) => {
  const db = getDb(c.env);
  await logoutByToken(db, c.req.raw, c.req.query("token"));
  return c.json({ ok: true });
});

apiRouter.use("/users*", requireStaff);
apiRouter.use("/books*", requireStaff);
apiRouter.use("/isbn/*", requireStaff);
apiRouter.use("/ocr/*", requireStaff);
apiRouter.use("/images/*", requireStaff);
apiRouter.use("/dashboard", requireStaff);
apiRouter.use("/loans*", requireStaff);
apiRouter.use("/loan-requests*", requireStaff);
apiRouter.use("/settings*", requireStaff);
apiRouter.use("/activity", requireStaff);
apiRouter.use("/options", requireStaff);
apiRouter.use("/export/*", requireStaff);

apiRouter.get("/users", requireStaff, requireAdminRole, async (c) => {
  const db = getDb(c.env);
  const users = await listStaffUsers(db);
  return c.json({ users });
});

apiRouter.post("/users", requireStaff, requireAdminRole, zValidator("json", createStaffUserSchema), async (c) => {
  const db = getDb(c.env);
  const payload = c.req.valid("json");
  const actor = c.get("authUser");

  try {
    const user = await createStaffUser(db, payload, actor);
    return c.json({ user }, 201);
  } catch (error) {
    return badRequest(c, error instanceof Error ? error.message : "Unable to create staff user.");
  }
});

apiRouter.get("/books", async (c) => {
  const db = getDb(c.env);
  const parsed = bookFilterSchema.safeParse({
    search: c.req.query("search"),
    category: c.req.query("category"),
    author: c.req.query("author"),
    language: c.req.query("language"),
    status: c.req.query("status"),
    location: c.req.query("location"),
    includeArchived: c.req.query("includeArchived") === "1",
    includeCopies: c.req.query("includeCopies") === "1",
    sort: c.req.query("sort") ?? "recent",
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : 40,
    offset: c.req.query("offset") ? Number(c.req.query("offset")) : 0
  });

  if (!parsed.success) {
    return badRequest(c, "Invalid filters", parsed.error.flatten());
  }

  const result = await listBooks(db, parsed.data);
  return c.json(result);
});

apiRouter.get("/books/:id", async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid book id");

  const db = getDb(c.env);
  const book = await getBookById(db, id);
  if (!book) return notFound(c, "Book not found");

  return c.json(book);
});

apiRouter.post("/books/duplicates", zValidator("json", duplicateCheckSchema), async (c) => {
  const payload = c.req.valid("json");
  const db = getDb(c.env);

  const duplicates = await findDuplicateMatches(db, payload);
  return c.json({ duplicates });
});

apiRouter.post("/books", zValidator("json", bookPayloadSchema), async (c) => {
  const payload = c.req.valid("json");
  const db = getDb(c.env);

  const duplicates = await findDuplicateMatches(db, {
    isbn10: payload.isbn10,
    isbn13: payload.isbn13,
    title: payload.title,
    contributors: payload.contributors,
    excludeBookId: undefined
  });

  if (duplicates.length > 0 && !payload.forceSave) {
    return conflict(c, "Possible duplicate books found", {
      duplicates
    });
  }

  const book = await createBook(db, payload);
  return c.json({ book }, 201);
});

apiRouter.put("/books/:id", zValidator("json", bookPayloadSchema), async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid book id");

  const payload = c.req.valid("json");
  const db = getDb(c.env);

  const duplicates = await findDuplicateMatches(db, {
    isbn10: payload.isbn10,
    isbn13: payload.isbn13,
    title: payload.title,
    contributors: payload.contributors,
    excludeBookId: id
  });

  if (duplicates.length > 0 && !payload.forceSave) {
    return conflict(c, "Possible duplicate books found", {
      duplicates
    });
  }

  const book = await updateBook(db, id, payload);
  if (!book) {
    return notFound(c, "Book not found");
  }

  return c.json({ book });
});

apiRouter.post("/books/:id/archive", async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid book id");

  const db = getDb(c.env);
  await archiveBook(db, id);

  return c.json({ ok: true });
});

apiRouter.post("/books/:id/restore", async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid book id");

  const db = getDb(c.env);
  await restoreBook(db, id);

  return c.json({ ok: true });
});

apiRouter.delete("/books/:id", async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid book id");

  const db = getDb(c.env);
  const deleted = await deleteBookPermanently(db, id);
  if (!deleted) {
    return notFound(c, "Book not found");
  }

  return c.json({ ok: true });
});

apiRouter.post("/isbn/lookup", zValidator("json", isbnLookupSchema), async (c) => {
  const payload = c.req.valid("json");
  const db = getDb(c.env);

  const lookup = await lookupIsbn(c.env, db, payload.isbn);
  return c.json(lookup);
});

apiRouter.post("/ocr/extract", zValidator("json", ocrExtractSchema), async (c) => {
  const payload = c.req.valid("json");
  const result = await extractMetadataFromImage(c.env, payload.imageDataUrl, payload.languageHint);

  return c.json(result);
});

apiRouter.post("/images/cover", zValidator("json", imageUploadSchema), async (c) => {
  const payload = c.req.valid("json");

  try {
    const stored = await storeCoverImage(c.env, payload.imageDataUrl);
    return c.json(stored, 201);
  } catch (error) {
    return badRequest(c, error instanceof Error ? error.message : "Failed to upload image");
  }
});

apiRouter.get("/dashboard", async (c) => {
  const db = getDb(c.env);
  const stats = await getDashboardStats(db);
  return c.json(stats);
});

apiRouter.get("/loans", async (c) => {
  const db = getDb(c.env);
  const data = await listLoans(db);
  return c.json({ loans: data });
});

apiRouter.get("/loan-requests", async (c) => {
  const db = getDb(c.env);
  const requests = await listLoanRequests(db, {
    status: c.req.query("status") ?? undefined,
    includePrivatePhone: true,
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : 120
  });

  return c.json({ requests });
});

apiRouter.post("/loans", zValidator("json", loanCreateSchema), async (c) => {
  const payload = c.req.valid("json");
  const db = getDb(c.env);

  try {
    const loan = await createLoan(db, payload);
    return c.json({ loan }, 201);
  } catch (error) {
    if (error instanceof LoanConflictError) {
      return conflict(c, error.message);
    }

    return badRequest(c, error instanceof Error ? error.message : "Could not create loan");
  }
});

apiRouter.post("/loans/:id/return", zValidator("json", loanReturnSchema), async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid loan id");

  const payload = c.req.valid("json");
  const db = getDb(c.env);

  const loan = await returnLoan(db, id, payload);
  if (!loan) return notFound(c, "Loan not found");

  return c.json({ loan });
});

apiRouter.post("/loan-requests/:id/decision", zValidator("json", loanRequestDecisionSchema), async (c) => {
  const id = parseBookId(c.req.param("id"));
  if (!id) return badRequest(c, "Invalid loan request id");

  const payload = c.req.valid("json");
  const db = getDb(c.env);

  if (payload.status !== "approved" && payload.status !== "rejected" && payload.status !== "cancelled") {
    return badRequest(c, "Invalid decision status");
  }

  try {
    const request = await decideLoanRequest(db, id, payload, c.get("authUser"));
    if (!request) {
      return notFound(c, "Loan request not found");
    }

    return c.json({ request });
  } catch (error) {
    if (error instanceof LoanConflictError) {
      return conflict(c, error.message);
    }

    return badRequest(c, error instanceof Error ? error.message : "Could not process request");
  }
});

apiRouter.get("/settings", async (c) => {
  const db = getDb(c.env);
  const settings = await getSettings(db);
  return c.json({ settings });
});

apiRouter.put("/settings", zValidator("json", settingsSchema), async (c) => {
  const payload = c.req.valid("json");
  const db = getDb(c.env);

  const settings = await updateSettings(db, payload);
  return c.json({ settings });
});

apiRouter.get("/activity", async (c) => {
  const db = getDb(c.env);
  const limit = Math.min(100, Number(c.req.query("limit") ?? 40));

  const rows = await db
    .select()
    .from(activityLogs)
    .orderBy(desc(activityLogs.createdAt))
    .limit(Number.isNaN(limit) ? 40 : limit);

  return c.json({
    activities: rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      message: row.message,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      createdAt: row.createdAt
    }))
  });
});

apiRouter.get("/options", async (c) => {
  const db = getDb(c.env);
  const options = await listLibraryOptions(db);
  return c.json(options);
});

apiRouter.get("/export/books.csv", async (c) => {
  const db = getDb(c.env);
  const csv = await exportBooksCsv(db);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=books-export.csv"
    }
  });
});

apiRouter.get("/export/loans.csv", async (c) => {
  const db = getDb(c.env);
  const csv = await exportLoansCsv(db);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=loans-export.csv"
    }
  });
});
