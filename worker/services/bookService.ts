import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import type { BookFilterInput, BookPayloadInput } from "@shared/schemas";
import type { BookListItem } from "@shared/types";
import type { DbClient } from "../db/client";
import {
  acquisitions,
  bookPeople,
  books,
  bookTags,
  categories,
  languages,
  loans,
  people,
  publishers,
  tags
} from "../db/schema";
import { logActivity } from "./activityService";
import { generateCodes } from "./codeService";
import { clearBookRelations, ensureCategoryId, ensureLanguageId, ensurePersonId, ensurePublisherId, ensureTagId } from "./referenceService";
import { normalizeKey, normalizeTitleSearch, normalizeUnicode, parseJsonSafely } from "../utils/text";

const normalizeIsbnValue = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.replace(/[^0-9Xx]/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
};

const splitCommaList = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const mapListRow = (row: any): BookListItem => ({
  id: row.id,
  accessionCode: row.accessionCode,
  publicCode: row.publicCode,
  title: row.title ?? undefined,
  subtitle: row.subtitle ?? undefined,
  authors: splitCommaList(row.authors),
  category: row.categoryName ?? undefined,
  language: row.languageName ?? undefined,
  publicationYear: row.publicationYear ?? undefined,
  coverImageKey: row.coverImageKey ?? undefined,
  status: row.status,
  isArchived: Boolean(row.isArchived),
  isPublic: Boolean(row.isPublic),
  room: row.room ?? undefined,
  cabinet: row.cabinet ?? undefined,
  rack: row.rack ?? undefined,
  shelf: row.shelf ?? undefined,
  positionNote: row.positionNote ?? undefined,
  dateAdded: row.dateAdded
});

const insertRelations = async (db: DbClient, bookId: number, payload: BookPayloadInput): Promise<void> => {
  const contributors = payload.contributors ?? [];
  for (const contributor of contributors) {
    const personId = await ensurePersonId(db, contributor.name);
    if (!personId) continue;
    await db.insert(bookPeople).values({
      bookId,
      personId,
      role: contributor.role,
      sortOrder: contributor.sortOrder ?? 0
    });
  }

  const uniqueTags = [...new Set((payload.tags ?? []).map((tag) => normalizeUnicode(tag)).filter(Boolean))] as string[];
  for (const tagName of uniqueTags) {
    const tagId = await ensureTagId(db, tagName);
    if (!tagId) continue;
    await db.insert(bookTags).values({
      bookId,
      tagId
    });
  }
};

const upsertAcquisition = async (db: DbClient, bookId: number, payload: BookPayloadInput): Promise<void> => {
  if (!payload.acquisition) {
    return;
  }

  const now = new Date().toISOString();

  await db
    .insert(acquisitions)
    .values({
      bookId,
      acquisitionType: payload.acquisition.acquisitionType,
      storeName: payload.acquisition.storeName,
      purchaseDate: payload.acquisition.purchaseDate,
      price: payload.acquisition.price,
      giftDate: payload.acquisition.giftDate,
      giverName: payload.acquisition.giverName,
      giftNote: payload.acquisition.giftNote,
      acquisitionNote: payload.acquisition.acquisitionNote,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: acquisitions.bookId,
      set: {
        acquisitionType: payload.acquisition.acquisitionType,
        storeName: payload.acquisition.storeName,
        purchaseDate: payload.acquisition.purchaseDate,
        price: payload.acquisition.price,
        giftDate: payload.acquisition.giftDate,
        giverName: payload.acquisition.giverName,
        giftNote: payload.acquisition.giftNote,
        acquisitionNote: payload.acquisition.acquisitionNote,
        updatedAt: now
      }
    });
};

const categoryDistributionQuery = sql<string>`COALESCE((SELECT c.name FROM categories c WHERE c.id = ${books.categoryId}), '')`;
const languageDistributionQuery = sql<string>`COALESCE((SELECT l.name FROM languages l WHERE l.id = ${books.languageId}), '')`;
const authorQuery = sql<string>`COALESCE((SELECT group_concat(pe.name, ', ')
  FROM book_people bp
  JOIN people pe ON pe.id = bp.person_id
  WHERE bp.book_id = ${books.id} AND bp.role = 'author'
  ORDER BY bp.sort_order), '')`;

export const listBooks = async (db: DbClient, filters: BookFilterInput): Promise<{ items: BookListItem[]; total: number }> => {
  const whereParts: any[] = [];

  if (!filters.includeArchived) {
    whereParts.push(eq(books.isArchived, false));
  }

  if (filters.status) {
    whereParts.push(eq(books.status, filters.status));
  }

  if (filters.category) {
    const key = normalizeKey(filters.category);
    if (key) {
      whereParts.push(
        sql<boolean>`${books.categoryId} IN (SELECT id FROM categories WHERE name_normalized = ${key})`
      );
    }
  }

  if (filters.language) {
    const key = normalizeKey(filters.language);
    if (key) {
      whereParts.push(
        sql<boolean>`${books.languageId} IN (SELECT id FROM languages WHERE name_normalized = ${key})`
      );
    }
  }

  if (filters.author) {
    const authorLike = `%${filters.author.trim()}%`;
    whereParts.push(
      sql<boolean>`${books.id} IN (
        SELECT bp.book_id
        FROM book_people bp
        JOIN people pe ON pe.id = bp.person_id
        WHERE bp.role = 'author' AND pe.name LIKE ${authorLike}
      )`
    );
  }

  if (filters.location) {
    const search = `%${filters.location.trim()}%`;
    whereParts.push(
      or(
        like(books.room, search),
        like(books.cabinet, search),
        like(books.rack, search),
        like(books.shelf, search),
        like(books.positionNote, search)
      )
    );
  }

  if (filters.search) {
    const normalizedSearch = normalizeTitleSearch(filters.search);
    const plain = `%${filters.search.trim()}%`;
    whereParts.push(
      or(
        normalizedSearch ? like(books.titleSearch, `%${normalizedSearch}%`) : undefined,
        like(books.accessionCode, plain),
        like(books.publicCode, plain),
        sql<boolean>`${books.id} IN (
          SELECT bp.book_id
          FROM book_people bp
          JOIN people pe ON pe.id = bp.person_id
          WHERE bp.role = 'author' AND pe.name LIKE ${plain}
        )`
      )
    );
  }

  const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

  const orderByClause = (() => {
    switch (filters.sort) {
      case "title":
        return [asc(books.title)];
      case "publicationYear":
        return [desc(books.publicationYear), desc(books.dateAdded)];
      case "author":
        return [asc(sql`authors`), asc(books.title)];
      case "recent":
      default:
        return [desc(books.dateAdded), desc(books.id)];
    }
  })();

  const limit = filters.limit ?? 40;
  const offset = filters.offset ?? 0;

  const rows = await db
    .select({
      id: books.id,
      accessionCode: books.accessionCode,
      publicCode: books.publicCode,
      title: books.title,
      subtitle: books.subtitle,
      publicationYear: books.publicationYear,
      coverImageKey: books.coverImageKey,
      status: books.status,
      isArchived: books.isArchived,
      isPublic: books.isPublic,
      room: books.room,
      cabinet: books.cabinet,
      rack: books.rack,
      shelf: books.shelf,
      positionNote: books.positionNote,
      dateAdded: books.dateAdded,
      categoryName: categoryDistributionQuery,
      languageName: languageDistributionQuery,
      authors: authorQuery
    })
    .from(books)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(books)
    .where(whereClause);

  return {
    items: rows.map(mapListRow),
    total: Number(countRows[0]?.count ?? 0)
  };
};

export const getBookById = async (db: DbClient, bookId: number) => {
  const rows = await db
    .select({
      id: books.id,
      accessionCode: books.accessionCode,
      publicCode: books.publicCode,
      title: books.title,
      subtitle: books.subtitle,
      originalTitle: books.originalTitle,
      edition: books.edition,
      printingNumber: books.printingNumber,
      publicationYear: books.publicationYear,
      publicationCountry: books.publicationCountry,
      subcategory: books.subcategory,
      series: books.series,
      volume: books.volume,
      pageCount: books.pageCount,
      format: books.format,
      condition: books.condition,
      isbn10: books.isbn10,
      isbn13: books.isbn13,
      room: books.room,
      cabinet: books.cabinet,
      rack: books.rack,
      shelf: books.shelf,
      positionNote: books.positionNote,
      summary: books.summary,
      personalNotes: books.personalNotes,
      publicNotes: books.publicNotes,
      metadataSource: books.metadataSource,
      metadataSourceDetails: books.metadataSourceDetails,
      coverImageKey: books.coverImageKey,
      status: books.status,
      isPublic: books.isPublic,
      isArchived: books.isArchived,
      isFavorite: books.isFavorite,
      dateAdded: books.dateAdded,
      archivedAt: books.archivedAt,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
      categoryName: categoryDistributionQuery,
      languageName: languageDistributionQuery,
      publisherName: sql<string>`COALESCE((SELECT p.name FROM publishers p WHERE p.id = ${books.publisherId}), '')`
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  const book = rows[0];
  if (!book) {
    return null;
  }

  const contributorRows = await db
    .select({
      role: bookPeople.role,
      sortOrder: bookPeople.sortOrder,
      name: people.name
    })
    .from(bookPeople)
    .innerJoin(people, eq(bookPeople.personId, people.id))
    .where(eq(bookPeople.bookId, bookId))
    .orderBy(asc(bookPeople.sortOrder));

  const tagRows = await db
    .select({
      name: tags.name
    })
    .from(bookTags)
    .innerJoin(tags, eq(bookTags.tagId, tags.id))
    .where(eq(bookTags.bookId, bookId));

  const acquisitionRows = await db.select().from(acquisitions).where(eq(acquisitions.bookId, bookId)).limit(1);

  const activeLoanRows = await db
    .select({
      id: loans.id,
      borrowerName: loans.borrowerName,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      status: loans.status
    })
    .from(loans)
    .where(and(eq(loans.bookId, bookId), eq(loans.status, "borrowed")))
    .limit(1);

  return {
    ...book,
    contributors: contributorRows,
    tags: tagRows.map((item) => item.name),
    acquisition: acquisitionRows[0] ?? null,
    activeLoan: activeLoanRows[0] ?? null,
    metadataSourceDetails: parseJsonSafely<Record<string, unknown>>(book.metadataSourceDetails)
  };
};

export const createBook = async (db: DbClient, payload: BookPayloadInput) => {
  const now = new Date().toISOString();
  const generatedCodes = await generateCodes(db);

  const categoryId = await ensureCategoryId(db, payload.categoryName);
  const languageId = await ensureLanguageId(db, payload.languageName);
  const publisherId = await ensurePublisherId(db, payload.publisherName);

  const inserted = await db
    .insert(books)
    .values({
      accessionCode: payload.accessionCode ?? generatedCodes.accessionCode,
      accessionYear: generatedCodes.accessionYear,
      accessionSerial: generatedCodes.accessionSerial,
      publicSerial: generatedCodes.publicSerial,
      publicCode: payload.publicCode ?? generatedCodes.publicCode,
      title: normalizeUnicode(payload.title),
      titleSearch: normalizeTitleSearch(payload.title),
      subtitle: normalizeUnicode(payload.subtitle),
      originalTitle: normalizeUnicode(payload.originalTitle),
      publisherId,
      imprint: normalizeUnicode(payload.imprint),
      isbn10: normalizeIsbnValue(payload.isbn10),
      isbn13: normalizeIsbnValue(payload.isbn13),
      edition: normalizeUnicode(payload.edition),
      printingNumber: normalizeUnicode(payload.printingNumber),
      publicationYear: payload.publicationYear,
      publicationCountry: normalizeUnicode(payload.publicationCountry),
      languageId,
      categoryId,
      subcategory: normalizeUnicode(payload.subcategory),
      series: normalizeUnicode(payload.series),
      volume: normalizeUnicode(payload.volume),
      pageCount: payload.pageCount,
      format: normalizeUnicode(payload.format),
      condition: normalizeUnicode(payload.condition),
      room: normalizeUnicode(payload.room),
      cabinet: normalizeUnicode(payload.cabinet),
      rack: normalizeUnicode(payload.rack),
      shelf: normalizeUnicode(payload.shelf),
      positionNote: normalizeUnicode(payload.positionNote),
      summary: normalizeUnicode(payload.summary),
      personalNotes: normalizeUnicode(payload.personalNotes),
      publicNotes: normalizeUnicode(payload.publicNotes),
      metadataSource: normalizeUnicode(payload.metadataSource),
      metadataSourceDetails: payload.metadataSourceDetails ? JSON.stringify(payload.metadataSourceDetails) : null,
      coverImageKey: payload.coverImageKey,
      isPublic: payload.isPublic,
      isArchived: false,
      isFavorite: payload.isFavorite,
      status: payload.status,
      dateAdded: payload.dateAdded ?? now,
      createdAt: now,
      updatedAt: now
    })
    .returning({
      id: books.id,
      accessionCode: books.accessionCode,
      publicCode: books.publicCode
    });

  const createdBook = inserted[0];

  await insertRelations(db, createdBook.id, payload);
  await upsertAcquisition(db, createdBook.id, payload);

  await logActivity(db, {
    entityType: "book",
    entityId: `${createdBook.id}`,
    action: "book_created",
    message: `Book added (${createdBook.accessionCode})`,
    payload: {
      title: payload.title,
      publicCode: createdBook.publicCode
    }
  });

  return getBookById(db, createdBook.id);
};

export const updateBook = async (db: DbClient, bookId: number, payload: BookPayloadInput) => {
  const now = new Date().toISOString();

  const categoryId = await ensureCategoryId(db, payload.categoryName);
  const languageId = await ensureLanguageId(db, payload.languageName);
  const publisherId = await ensurePublisherId(db, payload.publisherName);

  await db
    .update(books)
    .set({
      title: normalizeUnicode(payload.title),
      titleSearch: normalizeTitleSearch(payload.title),
      subtitle: normalizeUnicode(payload.subtitle),
      originalTitle: normalizeUnicode(payload.originalTitle),
      publisherId,
      imprint: normalizeUnicode(payload.imprint),
      isbn10: normalizeIsbnValue(payload.isbn10),
      isbn13: normalizeIsbnValue(payload.isbn13),
      edition: normalizeUnicode(payload.edition),
      printingNumber: normalizeUnicode(payload.printingNumber),
      publicationYear: payload.publicationYear,
      publicationCountry: normalizeUnicode(payload.publicationCountry),
      languageId,
      categoryId,
      subcategory: normalizeUnicode(payload.subcategory),
      series: normalizeUnicode(payload.series),
      volume: normalizeUnicode(payload.volume),
      pageCount: payload.pageCount,
      format: normalizeUnicode(payload.format),
      condition: normalizeUnicode(payload.condition),
      room: normalizeUnicode(payload.room),
      cabinet: normalizeUnicode(payload.cabinet),
      rack: normalizeUnicode(payload.rack),
      shelf: normalizeUnicode(payload.shelf),
      positionNote: normalizeUnicode(payload.positionNote),
      summary: normalizeUnicode(payload.summary),
      personalNotes: normalizeUnicode(payload.personalNotes),
      publicNotes: normalizeUnicode(payload.publicNotes),
      metadataSource: normalizeUnicode(payload.metadataSource),
      metadataSourceDetails: payload.metadataSourceDetails ? JSON.stringify(payload.metadataSourceDetails) : null,
      coverImageKey: payload.coverImageKey,
      isPublic: payload.isPublic,
      isFavorite: payload.isFavorite,
      status: payload.status,
      dateAdded: payload.dateAdded ?? now,
      updatedAt: now
    })
    .where(eq(books.id, bookId));

  await clearBookRelations(db, bookId);
  await insertRelations(db, bookId, payload);
  await upsertAcquisition(db, bookId, payload);

  await logActivity(db, {
    entityType: "book",
    entityId: `${bookId}`,
    action: "book_updated",
    message: `Book updated (${bookId})`,
    payload: {
      title: payload.title
    }
  });

  return getBookById(db, bookId);
};

export const archiveBook = async (db: DbClient, bookId: number) => {
  const now = new Date().toISOString();
  await db
    .update(books)
    .set({
      isArchived: true,
      archivedAt: now,
      updatedAt: now
    })
    .where(eq(books.id, bookId));

  await logActivity(db, {
    entityType: "book",
    entityId: `${bookId}`,
    action: "book_archived",
    message: `Book archived (${bookId})`
  });
};

export const restoreBook = async (db: DbClient, bookId: number) => {
  const now = new Date().toISOString();
  await db
    .update(books)
    .set({
      isArchived: false,
      archivedAt: null,
      updatedAt: now
    })
    .where(eq(books.id, bookId));

  await logActivity(db, {
    entityType: "book",
    entityId: `${bookId}`,
    action: "book_restored",
    message: `Book restored (${bookId})`
  });
};

export const listLibraryOptions = async (db: DbClient) => {
  const [categoryRows, languageRows, authorRows, tagRows, locationRows] = await Promise.all([
    db.select({ name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ name: languages.name }).from(languages).orderBy(asc(languages.name)),
    db
      .select({ name: people.name })
      .from(people)
      .where(
        sql<boolean>`${people.id} IN (SELECT DISTINCT person_id FROM book_people WHERE role = 'author')`
      )
      .orderBy(asc(people.name)),
    db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)),
    db
      .select({
        location: sql<string>`TRIM(COALESCE(${books.room}, '') || ' / ' || COALESCE(${books.cabinet}, '') || ' / ' || COALESCE(${books.rack}, '') || ' / ' || COALESCE(${books.shelf}, ''))`
      })
      .from(books)
      .where(eq(books.isArchived, false))
      .limit(200)
  ]);

  return {
    categories: categoryRows.map((item) => item.name),
    authors: authorRows.map((item) => item.name),
    languages: languageRows.map((item) => item.name),
    statuses: ["available", "borrowed", "lost"],
    locations: [...new Set(locationRows.map((row) => row.location).filter((value) => value && value !== "/ / /"))],
    tags: tagRows.map((item) => item.name)
  };
};

export const getPublicBookByCode = async (db: DbClient, shortCode: string) => {
  const row = await db
    .select({
      publicCode: books.publicCode,
      accessionCode: books.accessionCode,
      title: books.title,
      subtitle: books.subtitle,
      publicNotes: books.publicNotes,
      summary: books.summary,
      dateAdded: books.dateAdded,
      coverImageKey: books.coverImageKey,
      languageName: languageDistributionQuery,
      categoryName: categoryDistributionQuery,
      publisherName: sql<string>`COALESCE((SELECT p.name FROM publishers p WHERE p.id = ${books.publisherId}), '')`,
      authors: authorQuery,
      isPublic: books.isPublic,
      isArchived: books.isArchived
    })
    .from(books)
    .where(eq(books.publicCode, shortCode))
    .limit(1);

  if (!row[0]) {
    return null;
  }

  const result = row[0];
  if (!result.isPublic || result.isArchived) {
    return null;
  }

  return {
    publicCode: result.publicCode,
    accessionCode: result.accessionCode,
    title: result.title,
    subtitle: result.subtitle,
    publicNotes: result.publicNotes,
    summary: result.summary,
    dateAdded: result.dateAdded,
    coverImageKey: result.coverImageKey,
    languageName: result.languageName,
    categoryName: result.categoryName,
    publisherName: result.publisherName,
    authors: splitCommaList(result.authors)
  };
};