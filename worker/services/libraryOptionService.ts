import { asc, eq } from "drizzle-orm";
import type { OptionDomainInput, OptionValueInput } from "@shared/schemas";
import type { DbClient } from "../db/client";
import { categories, languages, publishers, tags } from "../db/schema";
import { normalizeKey, normalizeUnicode } from "../utils/text";

type OptionTable = typeof categories | typeof languages | typeof publishers | typeof tags;

interface OptionTableMeta {
  table: OptionTable;
  label: string;
}

const domainMap: Record<OptionDomainInput, OptionTableMeta> = {
  category: { table: categories, label: "categories" },
  language: { table: languages, label: "languages" },
  publisher: { table: publishers, label: "publishers" },
  tag: { table: tags, label: "tags" }
};

const getDomainTable = (domain: OptionDomainInput): OptionTableMeta => domainMap[domain];

const mapRow = (row: { id: number; name: string }) => ({
  id: row.id,
  name: row.name
});

export const listCatalogOptions = async (db: DbClient) => {
  const [categoryRows, languageRows, publisherRows, tagRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ id: languages.id, name: languages.name }).from(languages).orderBy(asc(languages.name)),
    db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name)),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name))
  ]);

  return {
    category: categoryRows.map(mapRow),
    language: languageRows.map(mapRow),
    publisher: publisherRows.map(mapRow),
    tag: tagRows.map(mapRow)
  };
};

export const createCatalogOption = async (db: DbClient, domain: OptionDomainInput, input: OptionValueInput) => {
  const { table } = getDomainTable(domain);
  const name = normalizeUnicode(input.name);
  const nameNormalized = normalizeKey(input.name);
  if (!name || !nameNormalized) {
    throw new Error("Option name is required.");
  }

  const now = new Date().toISOString();
  const inserted = await db
    .insert(table)
    .values({
      name,
      nameNormalized,
      updatedAt: now
    } as any)
    .onConflictDoUpdate({
      target: (table as any).nameNormalized,
      set: {
        name,
        updatedAt: now
      }
    })
    .returning({
      id: (table as any).id,
      name: (table as any).name
    });

  return mapRow(inserted[0] as { id: number; name: string });
};

export const updateCatalogOption = async (
  db: DbClient,
  domain: OptionDomainInput,
  id: number,
  input: OptionValueInput
) => {
  const { table } = getDomainTable(domain);
  const name = normalizeUnicode(input.name);
  const nameNormalized = normalizeKey(input.name);
  if (!name || !nameNormalized) {
    throw new Error("Option name is required.");
  }

  await db
    .update(table)
    .set({
      name,
      nameNormalized,
      updatedAt: new Date().toISOString()
    } as any)
    .where(eq((table as any).id, id));

  const rows = await db
    .select({
      id: (table as any).id,
      name: (table as any).name
    })
    .from(table as any)
    .where(eq((table as any).id, id))
    .limit(1);

  return rows[0] ? mapRow(rows[0] as { id: number; name: string }) : null;
};

export const deleteCatalogOption = async (db: DbClient, domain: OptionDomainInput, id: number) => {
  const { table } = getDomainTable(domain);
  const rows = await db
    .select({
      id: (table as any).id
    })
    .from(table as any)
    .where(eq((table as any).id, id))
    .limit(1);

  if (!rows[0]) {
    return false;
  }

  await db.delete(table as any).where(eq((table as any).id, id));
  return true;
};
