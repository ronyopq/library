import { z } from "zod";
import {
  acquisitionTypes,
  bookStatuses,
  contributorRoles,
  loanRequestStatuses,
  loanStatuses,
  staffRoles
} from "./constants";

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
  copyCount: z.number().int().min(1).max(50).optional(),
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
  includeCopies: z.boolean().optional(),
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
  bookCopyId: z.number().int().positive().optional(),
  borrowerName: z.string().trim().min(1).max(140),
  borrowerOrganization: optionalText,
  borrowerDesignation: optionalText,
  borrowerAddress: z.string().trim().max(800).optional(),
  borrowerPhone: optionalText,
  borrowerEmail: z.string().email().optional(),
  borrowedAt: optionalText,
  expectedReturnAt: optionalText,
  note: z.string().trim().max(1000).optional(),
  allowOverride: z.boolean().optional()
});

export const publicBorrowRequestCreateSchema = z.object({
  requesterName: z.string().trim().min(2).max(140),
  requesterOrganization: optionalText,
  requesterDesignation: optionalText,
  requesterAddress: z.string().trim().max(800).optional(),
  requesterPhone: z.string().trim().min(5).max(30),
  requesterEmail: z.string().email().optional(),
  borrowedAt: optionalText,
  expectedReturnAt: optionalText,
  requestedCopyId: z.number().int().positive().optional(),
  note: z.string().trim().max(1000).optional()
});

export const loanRequestDecisionSchema = z.object({
  status: z.enum(loanRequestStatuses),
  expectedReturnAt: optionalText,
  requestedCopyId: z.number().int().positive().optional(),
  adminNote: z.string().trim().max(1000).optional(),
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
  contactEmail: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
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

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(6).max(200)
});

export const createStaffUserSchema = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(6).max(200),
  fullName: optionalText,
  phone: optionalText,
  role: z.enum(staffRoles).default("librarian")
});

export const publicReviewCreateSchema = z.object({
  reviewerName: z.string().trim().min(2).max(120),
  reviewerPhone: z.string().trim().min(5).max(30),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(2).max(1500)
});

export const adminReviewUpdateSchema = z.object({
  reviewerName: z.string().trim().min(2).max(120),
  reviewerPhone: z.string().trim().min(5).max(30),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(2).max(1500),
  isHidden: z.boolean().optional()
});

export const optionDomainSchema = z.enum(["category", "language", "publisher", "tag"]);

export const optionValueSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export type BookPayloadInput = z.infer<typeof bookPayloadSchema>;
export type BookFilterInput = z.infer<typeof bookFilterSchema>;
export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
export type IsbnLookupInput = z.infer<typeof isbnLookupSchema>;
export type OcrExtractInput = z.infer<typeof ocrExtractSchema>;
export type LoanCreateInput = z.infer<typeof loanCreateSchema>;
export type PublicBorrowRequestCreateInput = z.infer<typeof publicBorrowRequestCreateSchema>;
export type LoanRequestDecisionInput = z.infer<typeof loanRequestDecisionSchema>;
export type LoanReturnInput = z.infer<typeof loanReturnSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type AcquisitionInput = z.infer<typeof acquisitionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
export type PublicReviewCreateInput = z.infer<typeof publicReviewCreateSchema>;
export type AdminReviewUpdateInput = z.infer<typeof adminReviewUpdateSchema>;
export type OptionDomainInput = z.infer<typeof optionDomainSchema>;
export type OptionValueInput = z.infer<typeof optionValueSchema>;
