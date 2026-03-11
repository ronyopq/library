import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/client";
import { bookCopies, books, loans } from "../db/schema";

const csvEscape = (value: unknown): string => {
  const text = `${value ?? ""}`;
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>) => {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return lines.join("\n");
};

export const exportBooksCsv = async (db: DbClient): Promise<string> => {
  const rows = await db
    .select({
      accessionCode: books.accessionCode,
      publicCode: books.publicCode,
      title: books.title,
      authors: sql<string>`COALESCE((SELECT group_concat(pe.name, '; ')
        FROM book_people bp
        JOIN people pe ON pe.id = bp.person_id
        WHERE bp.book_id = ${books.id} AND bp.role = 'author'), '')`,
      category: sql<string>`COALESCE((SELECT name FROM categories WHERE id = ${books.categoryId}), '')`,
      language: sql<string>`COALESCE((SELECT name FROM languages WHERE id = ${books.languageId}), '')`,
      isbn10: books.isbn10,
      isbn13: books.isbn13,
      publicationYear: books.publicationYear,
      location: sql<string>`TRIM(COALESCE(${books.room}, '') || ' / ' || COALESCE(${books.cabinet}, '') || ' / ' || COALESCE(${books.rack}, '') || ' / ' || COALESCE(${books.shelf}, ''))`,
      status: books.status,
      dateAdded: books.dateAdded,
      archived: books.isArchived
    })
    .from(books);

  return toCsv(
    [
      "accessionCode",
      "publicCode",
      "title",
      "authors",
      "category",
      "language",
      "isbn10",
      "isbn13",
      "publicationYear",
      "location",
      "status",
      "dateAdded",
      "archived"
    ],
    rows as Array<Record<string, unknown>>
  );
};

export const exportLoansCsv = async (db: DbClient): Promise<string> => {
  const rows = await db
    .select({
      id: loans.id,
      accessionCode: sql<string>`COALESCE((SELECT accession_code FROM books WHERE id = ${loans.bookId}), '')`,
      copyCode: sql<string>`COALESCE((SELECT copy_code FROM book_copies WHERE id = ${loans.bookCopyId}), '')`,
      bookTitle: sql<string>`COALESCE((SELECT title FROM books WHERE id = ${loans.bookId}), '')`,
      borrowerName: loans.borrowerName,
      borrowerPhone: loans.borrowerPhone,
      borrowerEmail: loans.borrowerEmail,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      status: loans.status,
      note: loans.note
    })
    .from(loans);

  return toCsv(
    [
      "id",
      "accessionCode",
      "copyCode",
      "bookTitle",
      "borrowerName",
      "borrowerPhone",
      "borrowerEmail",
      "borrowedAt",
      "expectedReturnAt",
      "returnedAt",
      "status",
      "note"
    ],
    rows as Array<Record<string, unknown>>
  );
};
