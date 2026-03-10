import type { BookPayloadInput } from "@shared/schemas";

export interface IsbnProviderResult {
  source: string;
  confidence: number;
  metadata: Partial<BookPayloadInput>;
  raw?: unknown;
}

export interface IsbnLookupOutput {
  isbn: string;
  merged: Partial<BookPayloadInput>;
  sources: IsbnProviderResult[];
  fromCache: boolean;
}