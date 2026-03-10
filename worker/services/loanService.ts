import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import type { LoanCreateInput, LoanReturnInput } from "@shared/schemas";
import type { LoanRecord } from "@shared/types";
import type { DbClient } from "../db/client";
import { books, loans } from "../db/schema";
import { logActivity } from "./activityService";

export class LoanConflictError extends Error {}

const mapLoanRow = (row: any): LoanRecord => {
  const isOverdue =
    row.status === "borrowed" && row.expectedReturnAt && new Date(row.expectedReturnAt).getTime() < Date.now();

  return {
    id: row.id,
    bookId: row.bookId,
    bookTitle: row.bookTitle ?? undefined,
    accessionCode: row.accessionCode ?? undefined,
    borrowerName: row.borrowerName,
    borrowerPhone: row.borrowerPhone ?? undefined,
    borrowerEmail: row.borrowerEmail ?? undefined,
    borrowedAt: row.borrowedAt,
    expectedReturnAt: row.expectedReturnAt ?? undefined,
    returnedAt: row.returnedAt ?? undefined,
    status: row.status,
    note: row.note ?? undefined,
    isOverdue
  };
};

export const listLoans = async (db: DbClient): Promise<LoanRecord[]> => {
  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      borrowerName: loans.borrowerName,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note,
      bookTitle: books.title,
      accessionCode: books.accessionCode
    })
    .from(loans)
    .leftJoin(books, eq(loans.bookId, books.id))
    .orderBy(desc(loans.borrowedAt), desc(loans.id));

  return rows.map(mapLoanRow);
};

export const createLoan = async (db: DbClient, payload: LoanCreateInput): Promise<LoanRecord> => {
  const now = new Date().toISOString();

  const activeLoanRows = await db
    .select({
      id: loans.id
    })
    .from(loans)
    .where(and(eq(loans.bookId, payload.bookId), eq(loans.status, "borrowed")))
    .limit(1);

  if (activeLoanRows.length > 0 && !payload.allowOverride) {
    throw new LoanConflictError("This book is already borrowed. Set override to continue.");
  }

  const inserted = await db
    .insert(loans)
    .values({
      bookId: payload.bookId,
      borrowerName: payload.borrowerName,
      borrowerPhone: payload.borrowerPhone,
      borrowerEmail: payload.borrowerEmail,
      borrowedAt: payload.borrowedAt ?? now,
      expectedReturnAt: payload.expectedReturnAt,
      status: "borrowed",
      note: payload.note,
      overrideDoubleLend: payload.allowOverride ?? false,
      createdAt: now,
      updatedAt: now
    })
    .returning({
      id: loans.id
    });

  await db
    .update(books)
    .set({
      status: "borrowed",
      updatedAt: now
    })
    .where(eq(books.id, payload.bookId));

  await logActivity(db, {
    entityType: "loan",
    entityId: `${inserted[0].id}`,
    action: "loan_created",
    message: `Loan created for book ${payload.bookId}`,
    payload: {
      borrowerName: payload.borrowerName,
      expectedReturnAt: payload.expectedReturnAt
    }
  });

  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      borrowerName: loans.borrowerName,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note,
      bookTitle: books.title,
      accessionCode: books.accessionCode
    })
    .from(loans)
    .leftJoin(books, eq(loans.bookId, books.id))
    .where(eq(loans.id, inserted[0].id))
    .limit(1);

  return mapLoanRow(rows[0]);
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

  if (payload.markLost) {
    await db
      .update(books)
      .set({
        status: "lost",
        updatedAt: now
      })
      .where(eq(books.id, loan.bookId));
  } else {
    const outstanding = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(loans)
      .where(and(eq(loans.bookId, loan.bookId), eq(loans.status, "borrowed")));

    if (Number(outstanding[0]?.count ?? 0) === 0) {
      await db
        .update(books)
        .set({
          status: "available",
          updatedAt: now
        })
        .where(eq(books.id, loan.bookId));
    }
  }

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
      borrowerName: loans.borrowerName,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note,
      bookTitle: books.title,
      accessionCode: books.accessionCode
    })
    .from(loans)
    .leftJoin(books, eq(loans.bookId, books.id))
    .where(eq(loans.id, loanId))
    .limit(1);

  return rows[0] ? mapLoanRow(rows[0]) : null;
};

export const countOverdueLoans = async (db: DbClient): Promise<number> => {
  const now = new Date().toISOString();
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(loans)
    .where(and(eq(loans.status, "borrowed"), lt(loans.expectedReturnAt, now)));

  return Number(rows[0]?.count ?? 0);
};