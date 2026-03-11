import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { LoanCreateInput, LoanReturnInput } from "@shared/schemas";
import type { LoanRecord } from "@shared/types";
import type { DbClient } from "../db/client";
import { bookCopies, books, loans } from "../db/schema";
import { logActivity } from "./activityService";
import {
  getActiveLoanForCopy,
  getAvailableCopyForBook,
  getCopyById,
  syncBookStatusFromCopies,
  updateCopyStatus
} from "./bookCopyService";

export class LoanConflictError extends Error {}

const maskPhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
};

const mapLoanRow = (row: any, includePrivatePhone = true): LoanRecord => {
  const isOverdue =
    row.status === "borrowed" && row.expectedReturnAt && new Date(row.expectedReturnAt).getTime() < Date.now();

  return {
    id: row.id,
    bookId: row.bookId,
    bookCopyId: row.bookCopyId ?? undefined,
    copyCode: row.copyCode ?? undefined,
    bookTitle: row.bookTitle ?? undefined,
    accessionCode: row.accessionCode ?? undefined,
    borrowerName: row.borrowerName,
    borrowerOrganization: row.borrowerOrganization ?? undefined,
    borrowerDesignation: row.borrowerDesignation ?? undefined,
    borrowerAddress: row.borrowerAddress ?? undefined,
    borrowerPhone: includePrivatePhone ? row.borrowerPhone ?? undefined : undefined,
    borrowerPhoneMasked: maskPhone(row.borrowerPhone),
    borrowerEmail: row.borrowerEmail ?? undefined,
    borrowedAt: row.borrowedAt,
    expectedReturnAt: row.expectedReturnAt ?? undefined,
    returnedAt: row.returnedAt ?? undefined,
    status: row.status,
    note: row.note ?? undefined,
    isOverdue
  };
};

const findTargetCopy = async (
  db: DbClient,
  payload: LoanCreateInput
): Promise<{
  id: number;
  bookId: number;
  copyCode: string;
}> => {
  if (payload.bookCopyId) {
    const copy = await getCopyById(db, payload.bookCopyId);
    if (!copy || copy.bookId !== payload.bookId || copy.isArchived) {
      throw new LoanConflictError("Selected copy is invalid for this book.");
    }

    return {
      id: copy.id,
      bookId: copy.bookId,
      copyCode: copy.copyCode
    };
  }

  const availableCopy = await getAvailableCopyForBook(db, payload.bookId);
  if (!availableCopy) {
    throw new LoanConflictError("No available copy found. Choose a copy and allow override if needed.");
  }

  return {
    id: availableCopy.id,
    bookId: availableCopy.bookId,
    copyCode: availableCopy.copyCode
  };
};

export const listLoans = async (db: DbClient): Promise<LoanRecord[]> => {
  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      bookCopyId: loans.bookCopyId,
      borrowerName: loans.borrowerName,
      borrowerOrganization: loans.borrowerOrganization,
      borrowerDesignation: loans.borrowerDesignation,
      borrowerAddress: loans.borrowerAddress,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note,
      bookTitle: books.title,
      accessionCode: books.accessionCode,
      copyCode: bookCopies.copyCode
    })
    .from(loans)
    .leftJoin(books, eq(loans.bookId, books.id))
    .leftJoin(bookCopies, eq(loans.bookCopyId, bookCopies.id))
    .orderBy(desc(loans.borrowedAt), desc(loans.id));

  return rows.map((row) => mapLoanRow(row, true));
};

export const createLoan = async (
  db: DbClient,
  payload: LoanCreateInput,
  options?: {
    source?: string;
  }
): Promise<LoanRecord> => {
  const now = new Date().toISOString();
  const targetCopy = await findTargetCopy(db, payload);

  const activeLoan = await getActiveLoanForCopy(db, targetCopy.id);
  if (activeLoan && !payload.allowOverride) {
    throw new LoanConflictError("Selected copy is already borrowed. Set override to continue.");
  }

  const inserted = await db
    .insert(loans)
    .values({
      bookId: payload.bookId,
      bookCopyId: targetCopy.id,
      borrowerName: payload.borrowerName,
      borrowerOrganization: payload.borrowerOrganization,
      borrowerDesignation: payload.borrowerDesignation,
      borrowerAddress: payload.borrowerAddress,
      borrowerPhone: payload.borrowerPhone,
      borrowerEmail: payload.borrowerEmail,
      borrowedAt: payload.borrowedAt ?? now,
      expectedReturnAt: payload.expectedReturnAt,
      status: "borrowed",
      source: options?.source ?? "admin",
      note: payload.note,
      overrideDoubleLend: payload.allowOverride ?? false,
      createdAt: now,
      updatedAt: now
    })
    .returning({
      id: loans.id
    });

  await updateCopyStatus(db, targetCopy.id, "borrowed");
  await syncBookStatusFromCopies(db, payload.bookId);

  await logActivity(db, {
    entityType: "loan",
    entityId: `${inserted[0].id}`,
    action: "loan_created",
    message: `Loan created for copy ${targetCopy.copyCode}`,
    payload: {
      borrowerName: payload.borrowerName,
      borrowerOrganization: payload.borrowerOrganization,
      borrowerDesignation: payload.borrowerDesignation,
      borrowerAddress: payload.borrowerAddress,
      copyCode: targetCopy.copyCode,
      expectedReturnAt: payload.expectedReturnAt,
      source: options?.source ?? "admin"
    }
  });

  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      bookCopyId: loans.bookCopyId,
      borrowerName: loans.borrowerName,
      borrowerOrganization: loans.borrowerOrganization,
      borrowerDesignation: loans.borrowerDesignation,
      borrowerAddress: loans.borrowerAddress,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note,
      bookTitle: books.title,
      accessionCode: books.accessionCode,
      copyCode: bookCopies.copyCode
    })
    .from(loans)
    .leftJoin(books, eq(loans.bookId, books.id))
    .leftJoin(bookCopies, eq(loans.bookCopyId, bookCopies.id))
    .where(eq(loans.id, inserted[0].id))
    .limit(1);

  return mapLoanRow(rows[0], true);
};

export const returnLoan = async (db: DbClient, loanId: number, payload: LoanReturnInput): Promise<LoanRecord | null> => {
  const now = new Date().toISOString();

  const existing = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
  const loan = existing[0];

  if (!loan) {
    return null;
  }

  const finalStatus = payload.markLost ? "lost" : "returned";

  await db
    .update(loans)
    .set({
      status: finalStatus,
      returnedAt: payload.returnedAt ?? now,
      note: payload.note ?? loan.note,
      updatedAt: now
    })
    .where(eq(loans.id, loanId));

  if (loan.bookCopyId) {
    await updateCopyStatus(db, loan.bookCopyId, payload.markLost ? "lost" : "available");
  }
  await syncBookStatusFromCopies(db, loan.bookId);

  await logActivity(db, {
    entityType: "loan",
    entityId: `${loanId}`,
    action: payload.markLost ? "loan_lost" : "loan_returned",
    message: payload.markLost ? `Loan marked lost (${loanId})` : `Loan returned (${loanId})`,
    payload: {
      returnedAt: payload.returnedAt ?? now
    }
  });

  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      bookCopyId: loans.bookCopyId,
      borrowerName: loans.borrowerName,
      borrowerOrganization: loans.borrowerOrganization,
      borrowerDesignation: loans.borrowerDesignation,
      borrowerAddress: loans.borrowerAddress,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note,
      bookTitle: books.title,
      accessionCode: books.accessionCode,
      copyCode: bookCopies.copyCode
    })
    .from(loans)
    .leftJoin(books, eq(loans.bookId, books.id))
    .leftJoin(bookCopies, eq(loans.bookCopyId, bookCopies.id))
    .where(eq(loans.id, loanId))
    .limit(1);

  return rows[0] ? mapLoanRow(rows[0], true) : null;
};

export const countOverdueLoans = async (db: DbClient): Promise<number> => {
  const now = new Date().toISOString();
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(loans)
    .where(and(eq(loans.status, "borrowed"), lt(loans.expectedReturnAt, now)));

  return Number(rows[0]?.count ?? 0);
};

export const deleteLoan = async (db: DbClient, loanId: number): Promise<boolean> => {
  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      bookCopyId: loans.bookCopyId,
      status: loans.status
    })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  const existing = rows[0];
  if (!existing) return false;

  await db.delete(loans).where(eq(loans.id, loanId));

  if (existing.bookCopyId && existing.status === "borrowed") {
    const activeRows = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(loans)
      .where(and(eq(loans.bookCopyId, existing.bookCopyId), eq(loans.status, "borrowed")));

    await updateCopyStatus(db, existing.bookCopyId, Number(activeRows[0]?.count ?? 0) > 0 ? "borrowed" : "available");
  }

  await syncBookStatusFromCopies(db, existing.bookId);

  await logActivity(db, {
    entityType: "loan",
    entityId: `${loanId}`,
    action: "loan_deleted",
    message: `Loan deleted (${loanId})`
  });

  return true;
};
