import { z } from "zod";
import { acquisitionTypes, bookStatuses, contributorRoles, loanStatuses } from "./constants";

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const contributorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.enum(contributorRoles),
  sortOrder: z.number().int().min(0).max(100).default(0)
});

export const acquisitionSchema = z
  .object({
    acquisitionType: z.enum(acquisitionTypes).default("other"),
    storeName: optionalText,
    purchaseDate: optionalText,
    price: z.number().min(0).optional(),
    giftDate: optionalText,
    giverName: optionalText,
    giftNote: optionalText,
    acquisitionNote: optionalText
  })
  .superRefine((value, ctx) => {
    if (value.acquisitionType === "purchase" && !value.purchaseDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purchase date is recommended for purchased books.",
        path: ["purchaseDate"]
      });
    }
    if (value.acquisitionType === "gift" && !value.giverName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Giver name is recommended for gifted books.",
        path: ["giverName"]
      });
    }
  });

export const bookPayloadSchema = z.object({
  title: optionalText,
  subtitle: optionalText,
  originalTitle: optionalText,
  edition: optionalText,
  printingNumber: optionalText,
  publicationYear: z.number().int().min(0).max(2100).optional(),
  publicationCountry: optionalText,
  languageName: optionalText,
  categoryName: optionalText,
  subcategory: optionalText,
  series: optionalText,
  volume: optionalText,
  pageCount: z.number().int().min(1).max(50000).optional(),
  format: optionalText,
  condition: optionalText,
  publisherName: optionalText,
  imprint: optionalText,
  isbn10: z.string().trim().max(20).optional(),
  isbn13: z.string().trim().max(20).optional(),
  accessionCode: optionalText,
  publicCode: optionalText,
  room: optionalText,
  cabinet: optionalText,
  rack: optionalText,
  shelf: optionalText,
  positionNote: optionalText,
  summary: z.string().trim().max(5000).optional(),
  personalNotes: z.string().trim().max(5000).optional(),
  publicNotes: z.string().trim().max(5000).optional(),
  metadataSource: optionalText,
  metadataSourceDetails: z.record(z.any()).optional(),
  coverImageKey: optionalText,
  isPublic: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  status: z.enum(bookStatuses).default("available"),
  dateAdded: optionalText,
  contributors: z.array(contributorSchema).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  acquisition: acquisitionSchema.optional(),
  forceSave: z.boolean().optional()
});

export const bookFilterSchema = z.object({
  search: optionalText,
  category: optionalText,
  author: optionalText,
  language: optionalText,
  status: optionalText,
  location: optionalText,
  includeArchived: z.boolean().optional(),
  sort: z.enum(["recent", "title", "author", "publicationYear"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional()
});

export const duplicateCheckSchema = z.object({
  isbn10: optionalText,
  isbn13: optionalText,
  title: optionalText,
  contributors: z.array(contributorSchema).default([]),
  excludeBookId: z.number().int().optional()
});

export const isbnLookupSchema = z.object({
  isbn: z.string().trim().min(8).max(20)
});

export const ocrExtractSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
  languageHint: optionalText
});

export const loanCreateSchema = z.object({
  bookId: z.number().int().positive(),
  borrowerName: z.string().trim().min(1).max(140),
  borrowerPhone: optionalText,
  borrowerEmail: z.string().email().optional(),
  borrowedAt: optionalText,
  expectedReturnAt: optionalText,
  note: z.string().trim().max(1000).optional(),
  allowOverride: z.boolean().optional()
});

export const loanReturnSchema = z.object({
  returnedAt: optionalText,
  note: z.string().trim().max(1000).optional(),
  markLost: z.boolean().optional()
});

export const settingsSchema = z.object({
  libraryName: z.string().trim().min(1).max(200),
  logoImageKey: optionalText,
  publicBaseUrl: optionalText,
  dateFormat: z.string().trim().min(4).max(40).default("yyyy-MM-dd"),
  contactName: optionalText,
  contactPhone: optionalText,
  contactEmail: z.string().email().optional(),
  publicVisibilityMode: z.enum(["selected", "all", "off"]).default("selected"),
  defaultLanguage: optionalText,
  defaultCategory: optionalText,
  labelIncludeTitle: z.boolean().default(true),
  labelIncludeAuthor: z.boolean().default(true),
  labelIncludeDate: z.boolean().default(false),
  labelIncludeQr: z.boolean().default(true),
  labelColumns: z.number().int().min(1).max(5).default(3),
  labelWidthMm: z.number().int().min(20).max(120).default(50),
  labelHeightMm: z.number().int().min(15).max(120).default(30)
});

export type BookPayloadInput = z.infer<typeof bookPayloadSchema>;
export type BookFilterInput = z.infer<typeof bookFilterSchema>;
export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
export type IsbnLookupInput = z.infer<typeof isbnLookupSchema>;
export type OcrExtractInput = z.infer<typeof ocrExtractSchema>;
export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type LoanReturnInput = z.infer<typeof loanReturnSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type AcquisitionInput = z.infer<typeof acquisitionSchema>;