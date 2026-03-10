import { and, eq, like, ne, or, sql } from "drizzle-orm";
import type { DuplicateCheckInput } from "@shared/schemas";
import type { DuplicateMatch } from "@shared/types";
import type { DbClient } from "../db/client";
import { books } from "../db/schema";
import { normalizeTitleSearch } from "../utils/text";
import { diceCoefficient } from "../utils/similarity";

export const findDuplicateMatches = async (db: DbClient, input: DuplicateCheckInput): Promise<DuplicateMatch[]> => {
  const normalizedTitle = normalizeTitleSearch(input.title);
  const isbn10 = input.isbn10?.replace(/[^0-9Xx]/g, "").toUpperCase();
  const isbn13 = input.isbn13?.replace(/[^0-9Xx]/g, "").toUpperCase();

  const titleChunk = normalizedTitle ? `%${normalizedTitle.split(" ").slice(0, 4).join(" %")}%` : undefined;

  const whereBase = [eq(books.isArchived, false)] as any[];
  if (input.excludeBookId) {
    whereBase.push(ne(books.id, input.excludeBookId));
  }

  const duplicateCandidates = await db
    .select({
      id: books.id,
      accessionCode: books.accessionCode,
      publicCode: books.publicCode,
      title: books.title,
      titleSearch: books.titleSearch,
      isbn10: books.isbn10,
      isbn13: books.isbn13,
      authors: sql<string>`COALESCE((SELECT group_concat(pe.name, ', ')
        FROM book_people bp
        JOIN people pe ON pe.id = bp.person_id
        WHERE bp.book_id = ${books.id} AND bp.role = 'author'), '')`
    })
    .from(books)
    .where(
      and(
        ...whereBase,
        or(
          isbn10 ? eq(books.isbn10, isbn10) : undefined,
          isbn13 ? eq(books.isbn13, isbn13) : undefined,
          titleChunk ? like(books.titleSearch, titleChunk) : undefined
        )
      )
    )
    .limit(20);

  const inputAuthorNames = input.contributors
    .filter((person) => person.role === "author")
    .map((person) => person.name.toLocaleLowerCase("en-US"));

  const matches: DuplicateMatch[] = [];

  for (const candidate of duplicateCandidates) {
    const authors = candidate.authors
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

    let score = 0;
    let reason = "";

    if (isbn10 && candidate.isbn10 === isbn10) {
      score = 1;
      reason = "Same ISBN-10 already exists";
    }

    if (isbn13 && candidate.isbn13 === isbn13) {
      score = Math.max(score, 1);
      reason = "Same ISBN-13 already exists";
    }

    if (normalizedTitle) {
      const titleScore = diceCoefficient(normalizedTitle, candidate.titleSearch ?? "");
      if (titleScore > 0.78) {
        score = Math.max(score, titleScore);
        reason = reason || "Very similar title";
      }

      if (authors.length > 0 && inputAuthorNames.length > 0) {
        const lowerAuthors = authors.map((name) => name.toLocaleLowerCase("en-US"));
        const overlap = inputAuthorNames.filter((name) => lowerAuthors.some((author) => author.includes(name) || name.includes(author)));
        if (overlap.length > 0) {
          score = Math.max(score, Math.min(0.95, titleScore + 0.12));
          reason = reason || "Similar title and overlapping author";
        }
      }
    }

    if (score > 0.72) {
      matches.push({
        id: candidate.id,
        accessionCode: candidate.accessionCode,
        publicCode: candidate.publicCode,
        title: candidate.title ?? undefined,
        authors,
        reason,
        score
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
};