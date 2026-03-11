import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { BookCopy } from "@shared/types";
import type { DbClient } from "../db/client";
import { bookCopies, books, loans } from "../db/schema";

const padCopyNumber = (value: number): string => value.toString().padStart(2, "0");
const padSerial = (value: number): string => value.toString().padStart(5, "0");

export const buildCopyCode = (accessionYear: number, accessionSerial: number, copyNumber: number): string =>
  `${String(accessionYear % 100).padStart(2, "0")}-${padSerial(accessionSerial)}-${padCopyNumber(copyNumber)}`;

const maskPhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
};

const mapCopyRow = (
  row: {
    id: number;
    bookId: number;
    copyNumber: number;
    copyCode: string;
    barcodeValue: string;
    status: string;
    isArchived: boolean;
    note: string | null;
    borrowerName: string | null;
    borrowerPhone: string | null;
    borrowedAt: string | null;
    expectedReturnAt: string | null;
  },
  includePrivatePhone: boolean
): BookCopy => ({
  id: row.id,
  bookId: row.bookId,
  copyNumber: row.copyNumber,
  copyCode: row.copyCode,
  barcodeValue: row.barcodeValue,
  status: row.status === "lost" ? "lost" : row.status === "borrowed" ? "borrowed" : "available",
  isArchived: Boolean(row.isArchived),
  note: row.note ?? undefined,
  borrowerName: row.borrowerName ?? undefined,
  borrowerPhone: includePrivatePhone ? row.borrowerPhone ?? undefined : undefined,
  borrowerPhoneMasked: row.borrowerPhone ? maskPhone(row.borrowerPhone) : undefined,
  borrowedAt: row.borrowedAt ?? undefined,
  expectedReturnAt: row.expectedReturnAt ?? undefined
});

export const getCopyById = async (db: DbClient, copyId: number) => {
  const rows = await db
    .select()
    .from(bookCopies)
    .where(eq(bookCopies.id, copyId))
    .limit(1);

  return rows[0] ?? null;
};

export const listBookCopies = async (
  db: DbClient,
  bookId: number,
  includePrivatePhone = true
): Promise<BookCopy[]> => {
  const rows = await db
    .select({
      id: bookCopies.id,
      bookId: bookCopies.bookId,
      copyNumber: bookCopies.copyNumber,
      copyCode: bookCopies.copyCode,
      barcodeValue: bookCopies.barcodeValue,
      status: bookCopies.status,
      isArchived: bookCopies.isArchived,
      note: bookCopies.note
    })
    .from(bookCopies)
    .where(and(eq(bookCopies.bookId, bookId), eq(bookCopies.isArchived, false)))
    .orderBy(asc(bookCopies.copyNumber));

  const copyIds = rows.map((row) => row.id);
  const activeLoanByCopyId = new Map<
    number,
    {
      borrowerName: string | null;
      borrowerPhone: string | null;
      borrowedAt: string | null;
      expectedReturnAt: string | null;
    }
  >();

  if (copyIds.length > 0) {
    const activeLoans = await db
      .select({
        copyId: loans.bookCopyId,
        borrowerName: loans.borrowerName,
        borrowerPhone: loans.borrowerPhone,
        borrowedAt: loans.borrowedAt,
        expectedReturnAt: loans.expectedReturnAt
      })
      .from(loans)
      .where(and(inArray(loans.bookCopyId, copyIds), eq(loans.status, "borrowed")));

    for (const loan of activeLoans) {
      if (!loan.copyId || activeLoanByCopyId.has(loan.copyId)) continue;
      activeLoanByCopyId.set(loan.copyId, {
        borrowerName: loan.borrowerName,
        borrowerPhone: loan.borrowerPhone ?? null,
        borrowedAt: loan.borrowedAt ?? null,
        expectedReturnAt: loan.expectedReturnAt ?? null
      });
    }
  }

  return rows.map((row) =>
    mapCopyRow(
      {
        ...row,
        borrowerName: activeLoanByCopyId.get(row.id)?.borrowerName ?? null,
        borrowerPhone: activeLoanByCopyId.get(row.id)?.borrowerPhone ?? null,
        borrowedAt: activeLoanByCopyId.get(row.id)?.borrowedAt ?? null,
        expectedReturnAt: activeLoanByCopyId.get(row.id)?.expectedReturnAt ?? null
      },
      includePrivatePhone
    )
  );
};

export const getCopyCountsForBookIds = async (
  db: DbClient,
  bookIds: number[]
): Promise<
  Map<
    number,
    {
      copyCount: number;
      availableCopyCount: number;
      borrowedCopyCount: number;
      lostCopyCount: number;
      primaryCopyCode?: string;
    }
  >
> => {
  if (bookIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      bookId: bookCopies.bookId,
      copyCount: sql<number>`COUNT(*)`,
      availableCopyCount: sql<number>`SUM(CASE WHEN ${bookCopies.status} = 'available' THEN 1 ELSE 0 END)`,
      borrowedCopyCount: sql<number>`SUM(CASE WHEN ${bookCopies.status} = 'borrowed' THEN 1 ELSE 0 END)`,
      lostCopyCount: sql<number>`SUM(CASE WHEN ${bookCopies.status} = 'lost' THEN 1 ELSE 0 END)`,
      primaryCopyCode: sql<string>`MIN(${bookCopies.copyCode})`
    })
    .from(bookCopies)
    .where(and(inArray(bookCopies.bookId, bookIds), eq(bookCopies.isArchived, false)))
    .groupBy(bookCopies.bookId);

  return new Map(
    rows.map((row) => [
      row.bookId,
      {
        copyCount: Number(row.copyCount ?? 0),
        availableCopyCount: Number(row.availableCopyCount ?? 0),
        borrowedCopyCount: Number(row.borrowedCopyCount ?? 0),
        lostCopyCount: Number(row.lostCopyCount ?? 0),
        primaryCopyCode: row.primaryCopyCode || undefined
      }
    ])
  );
};

export const getAvailableCopyForBook = async (db: DbClient, bookId: number) => {
  const rows = await db
    .select()
    .from(bookCopies)
    .where(and(eq(bookCopies.bookId, bookId), eq(bookCopies.isArchived, false), eq(bookCopies.status, "available")))
    .orderBy(asc(bookCopies.copyNumber))
    .limit(1);

  return rows[0] ?? null;
};

export const createBookCopies = async (
  db: DbClient,
  bookId: number,
  accessionYear: number,
  accessionSerial: number,
  count: number
): Promise<void> => {
  const safeCount = Number.isInteger(count) && count > 0 ? count : 1;
  const now = new Date().toISOString();

  for (let copyNumber = 1; copyNumber <= safeCount; copyNumber += 1) {
    const copyCode = buildCopyCode(accessionYear, accessionSerial, copyNumber);
    await db
      .insert(bookCopies)
      .values({
        bookId,
        copyNumber,
        copyCode,
        barcodeValue: copyCode,
        status: "available",
        isArchived: false,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing();
  }
};

export const syncBookStatusFromCopies = async (db: DbClient, bookId: number): Promise<void> => {
  const rows = await db
    .select({
      available: sql<number>`SUM(CASE WHEN ${bookCopies.status} = 'available' AND ${bookCopies.isArchived} = 0 THEN 1 ELSE 0 END)`,
      borrowed: sql<number>`SUM(CASE WHEN ${bookCopies.status} = 'borrowed' AND ${bookCopies.isArchived} = 0 THEN 1 ELSE 0 END)`,
      lost: sql<number>`SUM(CASE WHEN ${bookCopies.status} = 'lost' AND ${bookCopies.isArchived} = 0 THEN 1 ELSE 0 END)`
    })
    .from(bookCopies)
    .where(eq(bookCopies.bookId, bookId))
    .limit(1);

  const available = Number(rows[0]?.available ?? 0);
  const borrowed = Number(rows[0]?.borrowed ?? 0);
  const lost = Number(rows[0]?.lost ?? 0);

  const status = available > 0 ? "available" : borrowed > 0 ? "borrowed" : lost > 0 ? "lost" : "available";

  await db
    .update(books)
    .set({
      status,
      updatedAt: new Date().toISOString()
    })
    .where(eq(books.id, bookId));
};

export const updateCopyStatus = async (
  db: DbClient,
  copyId: number,
  status: "available" | "borrowed" | "lost"
): Promise<void> => {
  await db
    .update(bookCopies)
    .set({
      status,
      updatedAt: new Date().toISOString()
    })
    .where(eq(bookCopies.id, copyId));
};

export const getActiveLoanForCopy = async (db: DbClient, copyId: number) => {
  const rows = await db
    .select({
      id: loans.id
    })
    .from(loans)
    .where(and(eq(loans.bookCopyId, copyId), eq(loans.status, "borrowed")))
    .limit(1);

  return rows[0] ?? null;
};
