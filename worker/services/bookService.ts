import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { BookFilterInput, BookPayloadInput } from "@shared/schemas";
import type { BookListItem } from "@shared/types";
import type { DbClient } from "../db/client";
import {
  acquisitions,
  bookCopies,
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
import { createBookCopies, getCopyCountsForBookIds, listBookCopies, syncBookStatusFromCopies } from "./bookCopyService";
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

const maskPhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
};

const mapListRow = (
  row: any,
  copyInfo?: {
    copyCount: number;
    availableCopyCount: number;
    borrowedCopyCount: number;
    lostCopyCount: number;
    primaryCopyCode?: string;
  },
  authors?: string[]
): BookListItem => ({
  id: row.id,
  accessionCode: row.accessionCode,
  publicCode: row.publicCode,
  primaryCopyCode: copyInfo?.primaryCopyCode,
  title: row.title ?? undefined,
  subtitle: row.subtitle ?? undefined,
  authors: authors ?? splitCommaList(row.authors),
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
  copyCount: copyInfo?.copyCount ?? 1,
  availableCopyCount: copyInfo?.availableCopyCount ?? (row.status === "available" ? 1 : 0),
  borrowedCopyCount: copyInfo?.borrowedCopyCount ?? (row.status === "borrowed" ? 1 : 0),
  lostCopyCount: copyInfo?.lostCopyCount ?? (row.status === "lost" ? 1 : 0),
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

const getAuthorsByBookIds = async (db: DbClient, bookIds: number[]): Promise<Map<number, string[]>> => {
  const output = new Map<number, string[]>();
  if (bookIds.length === 0) {
    return output;
  }

  const rows = await db
    .select({
      bookId: bookPeople.bookId,
      authorName: people.name
    })
    .from(bookPeople)
    .innerJoin(people, eq(bookPeople.personId, people.id))
    .where(and(inArray(bookPeople.bookId, bookIds), eq(bookPeople.role, "author")))
    .orderBy(asc(bookPeople.bookId), asc(bookPeople.sortOrder), asc(people.name));

  for (const row of rows) {
    const list = output.get(row.bookId) ?? [];
    list.push(row.authorName);
    output.set(row.bookId, list);
  }

  return output;
};

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
      languageName: languageDistributionQuery
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

  const bookIds = rows.map((row) => row.id);
  const copyMap = await getCopyCountsForBookIds(db, bookIds);
  const authorMap = await getAuthorsByBookIds(db, bookIds);
  const copiesByBookId = new Map<number, Awaited<ReturnType<typeof listBookCopies>>>();

  if (filters.includeCopies) {
    const copyGroups = await Promise.all(
      bookIds.map(async (bookId) => ({
        bookId,
        copies: await listBookCopies(db, bookId, true)
      }))
    );

    for (const group of copyGroups) {
      copiesByBookId.set(group.bookId, group.copies);
    }
  }

  return {
    items: rows.map((row) => ({
      ...mapListRow(row, copyMap.get(row.id), authorMap.get(row.id) ?? []),
      copies: copiesByBookId.get(row.id)
    })),
    total: Number(countRows[0]?.count ?? 0)
  };
};

export interface PublicCatalogFilters {
  search?: string;
  location?: string;
  category?: string;
  language?: string;
  limit?: number;
  offset?: number;
}

export const listPublicBooks = async (
  db: DbClient,
  filters: PublicCatalogFilters
): Promise<{ items: BookListItem[]; total: number }> => {
  const whereParts: any[] = [eq(books.isArchived, false), eq(books.isPublic, true)];

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
        like(books.title, plain),
        like(books.subtitle, plain),
        like(books.series, plain),
        like(books.publicNotes, plain),
        like(books.summary, plain),
        like(books.publicCode, plain),
        like(books.accessionCode, plain),
        sql<boolean>`${books.publisherId} IN (
          SELECT id FROM publishers WHERE name LIKE ${plain}
        )`,
        sql<boolean>`${books.categoryId} IN (
          SELECT id FROM categories WHERE name LIKE ${plain}
        )`,
        sql<boolean>`${books.languageId} IN (
          SELECT id FROM languages WHERE name LIKE ${plain}
        )`,
        sql<boolean>`${books.id} IN (
          SELECT bp.book_id
          FROM book_people bp
          JOIN people pe ON pe.id = bp.person_id
          WHERE bp.role = 'author' AND pe.name LIKE ${plain}
        )`,
        or(
          like(books.room, plain),
          like(books.cabinet, plain),
          like(books.rack, plain),
          like(books.shelf, plain),
          like(books.positionNote, plain)
        )
      )
    );
  }

  const whereClause = and(...whereParts);
  const limit = filters.limit ?? 80;
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
      languageName: languageDistributionQuery
    })
    .from(books)
    .where(whereClause)
    .orderBy(desc(books.dateAdded), desc(books.id))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(books)
    .where(whereClause);

  const bookIds = rows.map((row) => row.id);
  const [copyMap, authorMap] = await Promise.all([getCopyCountsForBookIds(db, bookIds), getAuthorsByBookIds(db, bookIds)]);

  return {
    items: rows.map((row) => mapListRow(row, copyMap.get(row.id), authorMap.get(row.id) ?? [])),
    total: Number(countRows[0]?.count ?? 0)
  };
};

export const getPublicCatalogSummary = async (db: DbClient): Promise<{ totalPublicBooks: number }> => {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(books)
    .where(and(eq(books.isArchived, false), eq(books.isPublic, true)));

  return {
    totalPublicBooks: Number(rows[0]?.count ?? 0)
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
  const loanHistoryRows = await db
    .select({
      id: loans.id,
      status: loans.status,
      borrowerName: loans.borrowerName,
      borrowerDesignation: loans.borrowerDesignation,
      borrowerPhone: loans.borrowerPhone,
      borrowedAt: loans.borrowedAt,
      expectedReturnAt: loans.expectedReturnAt,
      returnedAt: loans.returnedAt,
      note: loans.note,
      copyCode: bookCopies.copyCode
    })
    .from(loans)
    .leftJoin(bookCopies, eq(loans.bookCopyId, bookCopies.id))
    .where(eq(loans.bookId, bookId))
    .orderBy(desc(loans.borrowedAt), desc(loans.id));

  const [copies, copyMap] = await Promise.all([
    listBookCopies(db, bookId, true),
    getCopyCountsForBookIds(db, [bookId])
  ]);
  const counts = copyMap.get(bookId);
  const activeCopyLoan = copies.find((copy) => copy.status === "borrowed");

  return {
    ...book,
    contributors: contributorRows,
    tags: tagRows.map((item) => item.name),
    acquisition: acquisitionRows[0] ?? null,
    activeLoan: activeCopyLoan
      ? {
          copyCode: activeCopyLoan.copyCode,
          borrowerName: activeCopyLoan.borrowerName,
          borrowerPhone: activeCopyLoan.borrowerPhone,
          borrowedAt: activeCopyLoan.borrowedAt,
          expectedReturnAt: activeCopyLoan.expectedReturnAt,
          status: activeCopyLoan.status
        }
      : null,
    copyCount: counts?.copyCount ?? (copies.length || 1),
    availableCopyCount: counts?.availableCopyCount ?? copies.filter((copy) => copy.status === "available").length,
    borrowedCopyCount: counts?.borrowedCopyCount ?? copies.filter((copy) => copy.status === "borrowed").length,
    lostCopyCount: counts?.lostCopyCount ?? copies.filter((copy) => copy.status === "lost").length,
    primaryCopyCode: counts?.primaryCopyCode,
    copies,
    loanHistory: loanHistoryRows.map((loan) => ({
      id: loan.id,
      status: loan.status,
      borrowerName: loan.borrowerName,
      borrowerDesignation: loan.borrowerDesignation ?? undefined,
      borrowerPhone: loan.borrowerPhone ?? undefined,
      borrowedAt: loan.borrowedAt,
      expectedReturnAt: loan.expectedReturnAt ?? undefined,
      returnedAt: loan.returnedAt ?? undefined,
      note: loan.note ?? undefined,
      copyCode: loan.copyCode ?? undefined
    })),
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
      accessionYear: books.accessionYear,
      accessionSerial: books.accessionSerial,
      publicCode: books.publicCode
    });

  const createdBook = inserted[0];

  await insertRelations(db, createdBook.id, payload);
  await upsertAcquisition(db, createdBook.id, payload);
  await createBookCopies(
    db,
    createdBook.id,
    createdBook.accessionYear,
    createdBook.accessionSerial,
    payload.copyCount ?? 1
  );
  await syncBookStatusFromCopies(db, createdBook.id);

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

  if (payload.copyCount && payload.copyCount > 0) {
    const rows = await db
      .select({
        accessionYear: books.accessionYear,
        accessionSerial: books.accessionSerial
      })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    const accessionYear = rows[0]?.accessionYear;
    const accessionSerial = rows[0]?.accessionSerial;
    if (accessionYear && accessionSerial) {
      await createBookCopies(db, bookId, accessionYear, accessionSerial, payload.copyCount);
    }
  }

  await syncBookStatusFromCopies(db, bookId);

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

export const deleteBookPermanently = async (db: DbClient, bookId: number): Promise<boolean> => {
  const existing = await db
    .select({
      id: books.id,
      isArchived: books.isArchived,
      accessionCode: books.accessionCode
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  const target = existing[0];
  if (!target) {
    return false;
  }

  await db.delete(books).where(eq(books.id, bookId));

  await logActivity(db, {
    entityType: "book",
    entityId: `${bookId}`,
    action: "book_deleted",
    message: `Book permanently deleted (${target.accessionCode})`,
    payload: {
      wasArchived: Boolean(target.isArchived)
    }
  });

  return true;
};

export const listLibraryOptions = async (db: DbClient) => {
  const [categoryRows, languageRows, authorRows, publisherRows, formatRows, conditionRows, tagRows, locationRows] = await Promise.all([
    db.select({ name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ name: languages.name }).from(languages).orderBy(asc(languages.name)),
    db
      .select({ name: people.name })
      .from(people)
      .where(
        sql<boolean>`${people.id} IN (SELECT DISTINCT person_id FROM book_people WHERE role = 'author')`
      )
      .orderBy(asc(people.name)),
    db.select({ name: publishers.name }).from(publishers).orderBy(asc(publishers.name)),
    db
      .selectDistinct({
        name: books.format
      })
      .from(books)
      .where(and(eq(books.isArchived, false), sql`${books.format} IS NOT NULL`, sql`TRIM(${books.format}) <> ''`))
      .orderBy(asc(books.format)),
    db
      .selectDistinct({
        name: books.condition
      })
      .from(books)
      .where(and(eq(books.isArchived, false), sql`${books.condition} IS NOT NULL`, sql`TRIM(${books.condition}) <> ''`))
      .orderBy(asc(books.condition)),
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
    publishers: publisherRows.map((item) => item.name),
    formats: formatRows.map((item) => item.name).filter(Boolean) as string[],
    conditions: conditionRows.map((item) => item.name).filter(Boolean) as string[],
    statuses: ["available", "borrowed", "lost"],
    locations: [...new Set(locationRows.map((row) => row.location).filter((value) => value && value !== "/ / /"))],
    tags: tagRows.map((item) => item.name)
  };
};

export const listPublicFilterOptions = async (db: DbClient) => {
  const [categoryRows, languageRows] = await Promise.all([
    db
      .selectDistinct({ name: categories.name })
      .from(categories)
      .where(
        sql<boolean>`${categories.id} IN (
          SELECT category_id FROM books WHERE is_public = 1 AND is_archived = 0 AND category_id IS NOT NULL
        )`
      )
      .orderBy(asc(categories.name)),
    db
      .selectDistinct({ name: languages.name })
      .from(languages)
      .where(
        sql<boolean>`${languages.id} IN (
          SELECT language_id FROM books WHERE is_public = 1 AND is_archived = 0 AND language_id IS NOT NULL
        )`
      )
      .orderBy(asc(languages.name))
  ]);

  return {
    categories: categoryRows.map((row) => row.name).filter(Boolean),
    languages: languageRows.map((row) => row.name).filter(Boolean)
  };
};

export const getPublicBookByCode = async (
  db: DbClient,
  shortCode: string,
  options?: {
    includePrivatePhone?: boolean;
  }
) => {
  const row = await db
    .select({
      id: books.id,
      publicCode: books.publicCode,
      accessionCode: books.accessionCode,
      title: books.title,
      subtitle: books.subtitle,
      publicNotes: books.publicNotes,
      summary: books.summary,
      dateAdded: books.dateAdded,
      coverImageKey: books.coverImageKey,
      room: books.room,
      cabinet: books.cabinet,
      rack: books.rack,
      shelf: books.shelf,
      positionNote: books.positionNote,
      languageName: languageDistributionQuery,
      categoryName: categoryDistributionQuery,
      publisherName: sql<string>`COALESCE((SELECT p.name FROM publishers p WHERE p.id = ${books.publisherId}), '')`,
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

  const [copies, copyMap, authorMap, historyRows] = await Promise.all([
    listBookCopies(db, result.id, Boolean(options?.includePrivatePhone)),
    getCopyCountsForBookIds(db, [result.id]),
    getAuthorsByBookIds(db, [result.id]),
    db
      .select({
        id: loans.id,
        status: loans.status,
        borrowerName: loans.borrowerName,
        borrowerOrganization: loans.borrowerOrganization,
        borrowerDesignation: loans.borrowerDesignation,
        borrowerPhone: loans.borrowerPhone,
        borrowedAt: loans.borrowedAt,
        expectedReturnAt: loans.expectedReturnAt,
        returnedAt: loans.returnedAt,
        note: loans.note,
        copyCode: bookCopies.copyCode
      })
      .from(loans)
      .leftJoin(bookCopies, eq(loans.bookCopyId, bookCopies.id))
      .where(eq(loans.bookId, result.id))
      .orderBy(desc(loans.borrowedAt), desc(loans.id))
      .limit(40)
  ]);
  const counts = copyMap.get(result.id);
  const authors = authorMap.get(result.id) ?? [];
  const activeLoans = copies
    .filter((copy) => copy.status === "borrowed")
    .map((copy) => ({
      copyCode: copy.copyCode,
      borrowerName: copy.borrowerName,
      borrowerPhone: options?.includePrivatePhone ? copy.borrowerPhone : undefined,
      borrowerPhoneMasked: copy.borrowerPhoneMasked,
      borrowedAt: copy.borrowedAt,
      expectedReturnAt: copy.expectedReturnAt
    }));
  const borrowHistory = historyRows.map((row) => ({
    id: row.id,
    status: row.status,
    borrowerName: row.borrowerName,
    borrowerOrganization: row.borrowerOrganization ?? undefined,
    borrowerDesignation: row.borrowerDesignation ?? undefined,
    borrowerPhone: options?.includePrivatePhone ? row.borrowerPhone ?? undefined : undefined,
    borrowerPhoneMasked: maskPhone(row.borrowerPhone),
    borrowedAt: row.borrowedAt,
    expectedReturnAt: row.expectedReturnAt ?? undefined,
    returnedAt: row.returnedAt ?? undefined,
    note: row.note ?? undefined,
    copyCode: row.copyCode ?? undefined
  }));

  return {
    publicCode: result.publicCode,
    accessionCode: result.accessionCode,
    title: result.title,
    subtitle: result.subtitle,
    publicNotes: result.publicNotes,
    summary: result.summary,
    dateAdded: result.dateAdded,
    coverImageKey: result.coverImageKey,
    room: result.room,
    cabinet: result.cabinet,
    rack: result.rack,
    shelf: result.shelf,
    positionNote: result.positionNote,
    languageName: result.languageName,
    categoryName: result.categoryName,
    publisherName: result.publisherName,
    authors,
    copyCount: counts?.copyCount ?? (copies.length || 1),
    availableCopyCount: counts?.availableCopyCount ?? copies.filter((copy) => copy.status === "available").length,
    borrowedCopyCount: counts?.borrowedCopyCount ?? activeLoans.length,
    lostCopyCount: counts?.lostCopyCount ?? copies.filter((copy) => copy.status === "lost").length,
    copies,
    activeLoans,
    borrowHistory
  };
};
