import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { DashboardStats } from "@shared/types";
import type { DbClient } from "../db/client";
import { activityLogs, bookPeople, books, categories, languages, loans, people } from "../db/schema";
import { listBooks } from "./bookService";
import { listLoans } from "./loanService";

export const getDashboardStats = async (db: DbClient): Promise<DashboardStats> => {
  const now = new Date().toISOString();

  const [
    totalBooksRow,
    totalCategoriesRow,
    totalAuthorsRow,
    totalLanguagesRow,
    totalBorrowedRow,
    overdueRow,
    archivedRow,
    categoryDistribution,
    languageDistribution,
    recentActivityRows
  ] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(books).where(eq(books.isArchived, false)),
    db.select({ count: sql<number>`COUNT(DISTINCT ${books.categoryId})` }).from(books).where(and(eq(books.isArchived, false), sql`${books.categoryId} IS NOT NULL`)),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${bookPeople.personId})` })
      .from(bookPeople)
      .innerJoin(books, eq(bookPeople.bookId, books.id))
      .where(and(eq(bookPeople.role, "author"), eq(books.isArchived, false))),
    db.select({ count: sql<number>`COUNT(DISTINCT ${books.languageId})` }).from(books).where(and(eq(books.isArchived, false), sql`${books.languageId} IS NOT NULL`)),
    db.select({ count: sql<number>`COUNT(*)` }).from(books).where(and(eq(books.status, "borrowed"), eq(books.isArchived, false))),
    db.select({ count: sql<number>`COUNT(*)` }).from(loans).where(and(eq(loans.status, "borrowed"), lt(loans.expectedReturnAt, now))),
    db.select({ count: sql<number>`COUNT(*)` }).from(books).where(eq(books.isArchived, true)),
    db
      .select({
        name: sql<string>`COALESCE((SELECT name FROM categories WHERE id = ${books.categoryId}), 'Uncategorized')`,
        count: sql<number>`COUNT(*)`
      })
      .from(books)
      .where(eq(books.isArchived, false))
      .groupBy(books.categoryId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(8),
    db
      .select({
        name: sql<string>`COALESCE((SELECT name FROM languages WHERE id = ${books.languageId}), 'Unknown')`,
        count: sql<number>`COUNT(*)`
      })
      .from(books)
      .where(eq(books.isArchived, false))
      .groupBy(books.languageId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(8),
    db
      .select({
        id: activityLogs.id,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        action: activityLogs.action,
        message: activityLogs.message,
        payload: activityLogs.payload,
        createdAt: activityLogs.createdAt
      })
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(10)
  ]);

  const recentBooks = await listBooks(db, {
    includeArchived: false,
    limit: 5,
    offset: 0,
    sort: "recent"
  });

  const recentLoans = (await listLoans(db)).slice(0, 5);

  return {
    totalBooks: Number(totalBooksRow[0]?.count ?? 0),
    totalCategories: Number(totalCategoriesRow[0]?.count ?? 0),
    totalAuthors: Number(totalAuthorsRow[0]?.count ?? 0),
    totalLanguages: Number(totalLanguagesRow[0]?.count ?? 0),
    totalBorrowed: Number(totalBorrowedRow[0]?.count ?? 0),
    overdueCount: Number(overdueRow[0]?.count ?? 0),
    archivedCount: Number(archivedRow[0]?.count ?? 0),
    recentlyAdded: recentBooks.items,
    recentLoans,
    recentActivity: recentActivityRows.map((item) => ({
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      action: item.action,
      message: item.message,
      payload: item.payload ? JSON.parse(item.payload) : undefined,
      createdAt: item.createdAt
    })),
    categoryDistribution: categoryDistribution.map((row) => ({ name: row.name, count: Number(row.count) })),
    languageDistribution: languageDistribution.map((row) => ({ name: row.name, count: Number(row.count) }))
  };
};