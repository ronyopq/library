import { eq } from "drizzle-orm";
import type { SettingsInput } from "@shared/schemas";
import type { AppSettings, PublicSiteSettings } from "@shared/types";
import type { DbClient } from "../db/client";
import { librarySettings } from "../db/schema";

const defaultSettings: SettingsInput = {
  libraryName: "My Library",
  logoImageKey: undefined,
  publicBaseUrl: undefined,
  dateFormat: "yyyy-MM-dd",
  contactName: undefined,
  contactPhone: undefined,
  contactEmail: undefined,
  contactAddress: undefined,
  siteMetaTitle: "My Library",
  siteMetaDescription: "Personal library catalog and barcode access.",
  publicVisibilityMode: "selected",
  defaultLanguage: undefined,
  defaultCategory: undefined,
  labelHeaderText: "My Library",
  labelIncludeTitle: true,
  labelIncludeAuthor: true,
  labelIncludeDate: false,
  labelIncludeQr: true,
  labelColumns: 3,
  labelWidthMm: 50,
  labelHeightMm: 30
};

const mapRow = (row: typeof librarySettings.$inferSelect): AppSettings => ({
  id: row.id,
  libraryName: row.libraryName,
  logoImageKey: row.logoImageKey ?? undefined,
  publicBaseUrl: row.publicBaseUrl ?? undefined,
  dateFormat: row.dateFormat,
  contactName: row.contactName ?? undefined,
  contactPhone: row.contactPhone ?? undefined,
  contactEmail: row.contactEmail ?? undefined,
  contactAddress: row.contactAddress ?? undefined,
  siteMetaTitle: row.siteMetaTitle ?? undefined,
  siteMetaDescription: row.siteMetaDescription ?? undefined,
  publicVisibilityMode: (row.publicVisibilityMode as AppSettings["publicVisibilityMode"]) ?? "selected",
  defaultLanguage: row.defaultLanguage ?? undefined,
  defaultCategory: row.defaultCategory ?? undefined,
  labelHeaderText: row.labelHeaderText ?? undefined,
  labelIncludeTitle: Boolean(row.labelIncludeTitle),
  labelIncludeAuthor: Boolean(row.labelIncludeAuthor),
  labelIncludeDate: Boolean(row.labelIncludeDate),
  labelIncludeQr: Boolean(row.labelIncludeQr),
  labelColumns: row.labelColumns,
  labelWidthMm: row.labelWidthMm,
  labelHeightMm: row.labelHeightMm,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const getSettings = async (db: DbClient): Promise<AppSettings> => {
  const existing = await db.select().from(librarySettings).where(eq(librarySettings.id, 1)).limit(1);

  if (existing[0]) {
    return mapRow(existing[0]);
  }

  await db.insert(librarySettings).values({ id: 1, ...defaultSettings });

  const inserted = await db.select().from(librarySettings).where(eq(librarySettings.id, 1)).limit(1);

  return mapRow(inserted[0]);
};

export const updateSettings = async (db: DbClient, input: SettingsInput): Promise<AppSettings> => {
  const now = new Date().toISOString();

  await db
    .insert(librarySettings)
    .values({
      id: 1,
      ...input,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: librarySettings.id,
      set: {
        ...input,
        updatedAt: now
      }
    });

  const row = await db.select().from(librarySettings).where(eq(librarySettings.id, 1)).limit(1);
  return mapRow(row[0]);
};

export const toPublicSiteSettings = (settings: AppSettings): PublicSiteSettings => ({
  libraryName: settings.libraryName,
  logoImageKey: settings.logoImageKey,
  publicBaseUrl: settings.publicBaseUrl,
  contactName: settings.contactName,
  contactPhone: settings.contactPhone,
  contactEmail: settings.contactEmail,
  contactAddress: settings.contactAddress,
  siteMetaTitle: settings.siteMetaTitle,
  siteMetaDescription: settings.siteMetaDescription,
  labelHeaderText: settings.labelHeaderText
});
