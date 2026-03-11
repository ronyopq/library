import { and, desc, eq } from "drizzle-orm";
import type { LoanRequestDecisionInput, PublicBorrowRequestCreateInput } from "@shared/schemas";
import type { AuthUser, LoanRequestRecord } from "@shared/types";
import type { DbClient } from "../db/client";
import { bookCopies, books, loanRequests } from "../db/schema";
import { logActivity } from "./activityService";
import { createLoan } from "./loanService";

const maskPhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
};

const mapLoanRequest = (
  row: any,
  includePrivatePhone: boolean
): LoanRequestRecord => ({
  id: row.id,
  bookId: row.bookId,
  requestedCopyId: row.requestedCopyId ?? undefined,
  copyCode: row.copyCode ?? undefined,
  publicCode: row.publicCode ?? undefined,
  bookTitle: row.bookTitle ?? undefined,
  requesterName: row.requesterName,
  requesterPhone: includePrivatePhone ? row.requesterPhone ?? undefined : undefined,
  requesterPhoneMasked: maskPhone(row.requesterPhone),
  requesterEmail: row.requesterEmail ?? undefined,
  expectedReturnAt: row.expectedReturnAt ?? undefined,
  note: row.note ?? undefined,
  adminNote: row.adminNote ?? undefined,
  requestedAt: row.requestedAt,
  reviewedAt: row.reviewedAt ?? undefined,
  status: row.status
});

const getRequestRow = async (db: DbClient, requestId: number) => {
  const rows = await db
    .select({
      id: loanRequests.id,
      bookId: loanRequests.bookId,
      requestedCopyId: loanRequests.requestedCopyId,
      requesterName: loanRequests.requesterName,
      requesterPhone: loanRequests.requesterPhone,
      requesterEmail: loanRequests.requesterEmail,
      expectedReturnAt: loanRequests.expectedReturnAt,
      note: loanRequests.note,
      adminNote: loanRequests.adminNote,
      requestedAt: loanRequests.requestedAt,
      reviewedAt: loanRequests.reviewedAt,
      reviewedByUserId: loanRequests.reviewedByUserId,
      approvedLoanId: loanRequests.approvedLoanId,
      status: loanRequests.status,
      publicCode: books.publicCode,
      bookTitle: books.title,
      copyCode: bookCopies.copyCode
    })
    .from(loanRequests)
    .leftJoin(books, eq(loanRequests.bookId, books.id))
    .leftJoin(bookCopies, eq(loanRequests.requestedCopyId, bookCopies.id))
    .where(eq(loanRequests.id, requestId))
    .limit(1);

  return rows[0] ?? null;
};

export const listLoanRequests = async (
  db: DbClient,
  options?: {
    status?: string;
    includePrivatePhone?: boolean;
    limit?: number;
  }
): Promise<LoanRequestRecord[]> => {
  const whereClause = options?.status ? eq(loanRequests.status, options.status) : undefined;
  const limit = Math.min(300, Math.max(1, options?.limit ?? 120));
  const rows = await db
    .select({
      id: loanRequests.id,
      bookId: loanRequests.bookId,
      requestedCopyId: loanRequests.requestedCopyId,
      requesterName: loanRequests.requesterName,
      requesterPhone: loanRequests.requesterPhone,
      requesterEmail: loanRequests.requesterEmail,
      expectedReturnAt: loanRequests.expectedReturnAt,
      note: loanRequests.note,
      adminNote: loanRequests.adminNote,
      requestedAt: loanRequests.requestedAt,
      reviewedAt: loanRequests.reviewedAt,
      status: loanRequests.status,
      publicCode: books.publicCode,
      bookTitle: books.title,
      copyCode: bookCopies.copyCode
    })
    .from(loanRequests)
    .leftJoin(books, eq(loanRequests.bookId, books.id))
    .leftJoin(bookCopies, eq(loanRequests.requestedCopyId, bookCopies.id))
    .where(whereClause)
    .orderBy(desc(loanRequests.requestedAt), desc(loanRequests.id))
    .limit(limit);

  return rows.map((row) => mapLoanRequest(row, Boolean(options?.includePrivatePhone)));
};

export const createPublicLoanRequest = async (
  db: DbClient,
  shortCode: string,
  payload: PublicBorrowRequestCreateInput
): Promise<LoanRequestRecord | null> => {
  const targetRows = await db
    .select({
      id: books.id,
      title: books.title,
      publicCode: books.publicCode,
      isPublic: books.isPublic,
      isArchived: books.isArchived
    })
    .from(books)
    .where(eq(books.publicCode, shortCode))
    .limit(1);

  const target = targetRows[0];
  if (!target || target.isArchived || !target.isPublic) {
    return null;
  }

  if (payload.requestedCopyId) {
    const copyRows = await db
      .select({
        id: bookCopies.id
      })
      .from(bookCopies)
      .where(
        and(
          eq(bookCopies.id, payload.requestedCopyId),
          eq(bookCopies.bookId, target.id),
          eq(bookCopies.isArchived, false)
        )
      )
      .limit(1);

    if (!copyRows[0]) {
      throw new Error("Selected copy is not valid.");
    }
  }

  const now = new Date().toISOString();
  const inserted = await db
    .insert(loanRequests)
    .values({
      bookId: target.id,
      requestedCopyId: payload.requestedCopyId,
      requesterName: payload.requesterName.trim(),
      requesterPhone: payload.requesterPhone.trim(),
      requesterEmail: payload.requesterEmail,
      expectedReturnAt: payload.expectedReturnAt,
      note: payload.note,
      status: "requested",
      requestedAt: now,
      createdAt: now,
      updatedAt: now
    })
    .returning({
      id: loanRequests.id
    });

  await logActivity(db, {
    entityType: "loan_request",
    entityId: `${inserted[0].id}`,
    action: "loan_request_created",
    message: `Public borrow request for ${target.title ?? shortCode}`,
    payload: {
      requesterName: payload.requesterName
    }
  });

  const created = await getRequestRow(db, inserted[0].id);
  return created ? mapLoanRequest(created, false) : null;
};

export const decideLoanRequest = async (
  db: DbClient,
  requestId: number,
  decision: LoanRequestDecisionInput,
  actor?: AuthUser
): Promise<LoanRequestRecord | null> => {
  const existing = await getRequestRow(db, requestId);
  if (!existing) {
    return null;
  }

  if (existing.status !== "requested") {
    throw new Error("This request is already processed.");
  }

  const now = new Date().toISOString();
  let approvedLoanId: number | undefined;

  if (decision.status === "approved") {
    const createdLoan = await createLoan(
      db,
      {
        bookId: existing.bookId,
        bookCopyId: decision.requestedCopyId ?? existing.requestedCopyId ?? undefined,
        borrowerName: existing.requesterName,
        borrowerPhone: existing.requesterPhone ?? undefined,
        borrowerEmail: existing.requesterEmail ?? undefined,
        expectedReturnAt: decision.expectedReturnAt ?? existing.expectedReturnAt ?? undefined,
        note: decision.adminNote ?? existing.note ?? undefined,
        allowOverride: decision.allowOverride
      },
      {
        source: "public_request"
      }
    );

    approvedLoanId = createdLoan.id;
  }

  await db
    .update(loanRequests)
    .set({
      status: decision.status,
      requestedCopyId: decision.requestedCopyId ?? existing.requestedCopyId ?? null,
      expectedReturnAt: decision.expectedReturnAt ?? existing.expectedReturnAt ?? null,
      adminNote: decision.adminNote ?? null,
      reviewedByUserId: actor?.id,
      approvedLoanId: approvedLoanId ?? null,
      reviewedAt: now,
      updatedAt: now
    })
    .where(eq(loanRequests.id, requestId));

  await logActivity(db, {
    entityType: "loan_request",
    entityId: `${requestId}`,
    action: decision.status === "approved" ? "loan_request_approved" : "loan_request_rejected",
    message:
      decision.status === "approved"
        ? `Loan request approved (${requestId})`
        : `Loan request ${decision.status} (${requestId})`,
    payload: {
      approvedLoanId,
      reviewedBy: actor?.username ?? "system"
    }
  });

  const updated = await getRequestRow(db, requestId);
  return updated ? mapLoanRequest(updated, true) : null;
};
