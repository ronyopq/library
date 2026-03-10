import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/client";
import { categories, languages, people, publishers, tags } from "../db/schema";
import { normalizeKey, normalizeUnicode } from "../utils/text";

const upsertSimpleEntity = async (
  db: DbClient,
  table: typeof categories | typeof languages | typeof people | typeof publishers | typeof tags,
  value?: string | null
): Promise<number | undefined> => {
  const name = normalizeUnicode(value);
  const nameNormalized = normalizeKey(value);

  if (!name || !nameNormalized) {
    return undefined;
  }

  const existing = await db
    .select({ id: table.id as any })
    .from(table as any)
    .where(eq((table as any).nameNormalized, nameNormalized))
    .limit(1);

  if (existing[0]?.id) {
    return Number(existing[0].id);
  }

  const insertPayload: Record<string, unknown> = {
    name,
    nameNormalized
  };

  if ("updatedAt" in table) {
    insertPayload.updatedAt = new Date().toISOString();
  }

  const inserted = await db
    .insert(table as any)
    .values(insertPayload)
    .returning({ id: (table as any).id });

  return inserted[0]?.id ? Number(inserted[0].id) : undefined;
};

export const ensureCategoryId = (db: DbClient, value?: string | null) => upsertSimpleEntity(db, categories, value);
export const ensureLanguageId = (db: DbClient, value?: string | null) => upsertSimpleEntity(db, languages, value);
export const ensurePublisherId = (db: DbClient, value?: string | null) => upsertSimpleEntity(db, publishers, value);
export const ensurePersonId = (db: DbClient, value?: string | null) => upsertSimpleEntity(db, people, value);
export const ensureTagId = (db: DbClient, value?: string | null) => upsertSimpleEntity(db, tags, value);

export const clearBookRelations = async (db: DbClient, bookId: number): Promise<void> => {
  await db.run(sql`DELETE FROM book_people WHERE book_id = ${bookId}`);
  await db.run(sql`DELETE FROM book_tags WHERE book_id = ${bookId}`);
};