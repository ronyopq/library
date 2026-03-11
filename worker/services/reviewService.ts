import { and, desc, eq, sql } from "drizzle-orm";
import type { PublicReviewCreateInput } from "@shared/schemas";
import type { BookReview } from "@shared/types";
import type { DbClient } from "../db/client";
import { bookReviews, books } from "../db/schema";
import { logActivity } from "./activityService";

export interface BookReviewSummary {
  averageRating: number;
  ratingCount: number;
  reviews: BookReview[];
}

const maskPhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
};

const mapReview = (row: {
  id: number;
  bookId: number;
  reviewerName: string;
  reviewerPhone: string;
  rating: number;
  comment: string;
  createdAt: string;
}, includePrivatePhone: boolean): BookReview => ({
  id: row.id,
  bookId: row.bookId,
  reviewerName: row.reviewerName,
  reviewerPhone: includePrivatePhone ? row.reviewerPhone : undefined,
  reviewerPhoneMasked: maskPhone(row.reviewerPhone),
  rating: row.rating,
  comment: row.comment,
  createdAt: row.createdAt
});

export const getBookReviewSummary = async (
  db: DbClient,
  bookId: number,
  includePrivatePhone = true
): Promise<BookReviewSummary> => {
  const [aggregateRows, reviewRows] = await Promise.all([
    db
      .select({
        avgRating: sql<number>`COALESCE(ROUND(AVG(${bookReviews.rating}), 2), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(bookReviews)
      .where(and(eq(bookReviews.bookId, bookId), eq(bookReviews.isHidden, false))),
    db
      .select({
        id: bookReviews.id,
        bookId: bookReviews.bookId,
        reviewerName: bookReviews.reviewerName,
        reviewerPhone: bookReviews.reviewerPhone,
        rating: bookReviews.rating,
        comment: bookReviews.comment,
        createdAt: bookReviews.createdAt
      })
      .from(bookReviews)
      .where(and(eq(bookReviews.bookId, bookId), eq(bookReviews.isHidden, false)))
      .orderBy(desc(bookReviews.createdAt), desc(bookReviews.id))
      .limit(50)
  ]);

  const avg = Number(aggregateRows[0]?.avgRating ?? 0);
  const count = Number(aggregateRows[0]?.count ?? 0);

  return {
    averageRating: Number.isFinite(avg) ? avg : 0,
    ratingCount: count,
    reviews: reviewRows.map((row) => mapReview(row, includePrivatePhone))
  };
};

const resolvePublicBook = async (db: DbClient, shortCode: string) => {
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      isArchived: books.isArchived,
      isPublic: books.isPublic
    })
    .from(books)
    .where(eq(books.publicCode, shortCode))
    .limit(1);

  return rows[0] ?? null;
};

export const addPublicReview = async (
  db: DbClient,
  shortCode: string,
  input: PublicReviewCreateInput
): Promise<BookReviewSummary | null> => {
  const target = await resolvePublicBook(db, shortCode);
  if (!target || target.isArchived || !target.isPublic) {
    return null;
  }

  const now = new Date().toISOString();
  await db.insert(bookReviews).values({
    bookId: target.id,
    reviewerName: input.reviewerName.trim(),
    reviewerPhone: input.reviewerPhone.trim(),
    rating: input.rating,
    comment: input.comment.trim(),
    isHidden: false,
    createdAt: now,
    updatedAt: now
  });

  await logActivity(db, {
    entityType: "review",
    entityId: `${target.id}`,
    action: "review_added",
    message: `Public review submitted for ${target.title ?? shortCode}`,
    payload: {
      rating: input.rating,
      reviewerName: input.reviewerName
    }
  });

  return getBookReviewSummary(db, target.id, false);
};

export const getPublicReviewSummaryByCode = async (
  db: DbClient,
  shortCode: string,
  options?: {
    includePrivatePhone?: boolean;
  }
): Promise<BookReviewSummary | null> => {
  const target = await resolvePublicBook(db, shortCode);
  if (!target || target.isArchived || !target.isPublic) {
    return null;
  }

  return getBookReviewSummary(db, target.id, Boolean(options?.includePrivatePhone));
};
