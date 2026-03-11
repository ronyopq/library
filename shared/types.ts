import type {
  acquisitionTypes,
  bookStatuses,
  contributorRoles,
  loanRequestStatuses,
  loanStatuses,
  staffRoles
} from "./constants";
import type { BookPayloadInput, SettingsInput } from "./schemas";

export type ContributorRole = (typeof contributorRoles)[number];
export type BookStatus = (typeof bookStatuses)[number];
export type LoanStatus = (typeof loanStatuses)[number];
export type LoanRequestStatus = (typeof loanRequestStatuses)[number];
export type AcquisitionType = (typeof acquisitionTypes)[number];
export type StaffRole = (typeof staffRoles)[number];

export interface AuthUser {
  id: number;
  username: string;
  fullName?: string;
  phone?: string;
  role: StaffRole;
}

export interface BookListItem {
  id: number;
  accessionCode: string;
  publicCode: string;
  primaryCopyCode?: string;
  title?: string;
  subtitle?: string;
  authors: string[];
  category?: string;
  language?: string;
  publicationYear?: number;
  coverImageKey?: string;
  status: BookStatus;
  isArchived: boolean;
  isPublic: boolean;
  room?: string;
  cabinet?: string;
  rack?: string;
  shelf?: string;
  positionNote?: string;
  copyCount: number;
  availableCopyCount: number;
  borrowedCopyCount: number;
  lostCopyCount: number;
  copies?: BookCopy[];
  dateAdded: string;
}

export interface BookCopy {
  id: number;
  bookId: number;
  copyNumber: number;
  copyCode: string;
  barcodeValue: string;
  status: BookStatus;
  isArchived: boolean;
  note?: string;
  borrowerName?: string;
  borrowerPhone?: string;
  borrowerPhoneMasked?: string;
  borrowedAt?: string;
  expectedReturnAt?: string;
}

export interface DuplicateMatch {
  id: number;
  accessionCode: string;
  publicCode: string;
  title?: string;
  authors: string[];
  reason: string;
  score: number;
}

export interface IsbnLookupResult {
  isbn: string;
  merged: Partial<BookPayloadInput>;
  sources: Array<{
    source: string;
    confidence: number;
    metadata: Partial<BookPayloadInput>;
  }>;
  fromCache: boolean;
}

export interface OcrExtractionResult {
  available: boolean;
  provider: string;
  message?: string;
  confidence: number;
  extracted: Partial<BookPayloadInput>;
  needsReviewFields: string[];
}

export interface LoanRecord {
  id: number;
  bookId: number;
  bookCopyId?: number;
  copyCode?: string;
  bookTitle?: string;
  accessionCode?: string;
  borrowerName: string;
  borrowerPhone?: string;
  borrowerPhoneMasked?: string;
  borrowerEmail?: string;
  borrowedAt: string;
  expectedReturnAt?: string;
  returnedAt?: string;
  status: LoanStatus;
  note?: string;
  isOverdue: boolean;
}

export interface LoanRequestRecord {
  id: number;
  bookId: number;
  requestedCopyId?: number;
  copyCode?: string;
  publicCode?: string;
  bookTitle?: string;
  requesterName: string;
  requesterPhone?: string;
  requesterPhoneMasked?: string;
  requesterEmail?: string;
  expectedReturnAt?: string;
  note?: string;
  adminNote?: string;
  requestedAt: string;
  reviewedAt?: string;
  status: LoanRequestStatus;
}

export interface ActivityLogItem {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardStats {
  totalBooks: number;
  totalCategories: number;
  totalAuthors: number;
  totalLanguages: number;
  totalBorrowed: number;
  overdueCount: number;
  archivedCount: number;
  recentlyAdded: BookListItem[];
  recentLoans: LoanRecord[];
  recentActivity: ActivityLogItem[];
  categoryDistribution: Array<{ name: string; count: number }>;
  languageDistribution: Array<{ name: string; count: number }>;
}

export interface BookReview {
  id: number;
  bookId: number;
  reviewerName: string;
  reviewerPhone?: string;
  reviewerPhoneMasked?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface LibraryOptions {
  categories: string[];
  authors: string[];
  languages: string[];
  publishers: string[];
  formats: string[];
  conditions: string[];
  statuses: string[];
  locations: string[];
  tags: string[];
}

export interface AppSettings extends SettingsInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
