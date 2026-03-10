import type { BookPayloadInput } from "@shared/schemas";
import type { OcrExtractionOutput } from "./types";

const getFirstMatch = (text: string, regexList: RegExp[]): string | undefined => {
  for (const regex of regexList) {
    const matched = text.match(regex);
    if (matched?.[1]) {
      return matched[1].trim();
    }
  }
  return undefined;
};

const splitNames = (value?: string): string[] =>
  (value ?? "")
    .split(/[;,\n]| and /gi)
    .map((item) => item.trim())
    .filter(Boolean);

export const extractMetadataFromText = (text: string): OcrExtractionOutput => {
  const normalized = text.normalize("NFC");

  const title = getFirstMatch(normalized, [/title\s*[:\-]\s*(.+)/i]);
  const authorsText = getFirstMatch(normalized, [/author\(s\)?\s*[:\-]\s*(.+)/i]);
  const publisherName = getFirstMatch(normalized, [/publisher\s*[:\-]\s*(.+)/i]);
  const isbn = getFirstMatch(normalized, [/isbn(?:-1[03])?\s*[:\-]?\s*([0-9Xx\-]{10,17})/i]);
  const edition = getFirstMatch(normalized, [/edition\s*[:\-]\s*(.+)/i]);
  const publicationYearText = getFirstMatch(normalized, [/publication\s*year\s*[:\-]\s*(\d{4})/i, /(19|20)\d{2}/]);
  const languageName = getFirstMatch(normalized, [/language\s*[:\-]\s*(.+)/i]);
  const pageCountText = getFirstMatch(normalized, [/pages?\s*[:\-]\s*(\d{1,5})/i]);

  const contributors: NonNullable<BookPayloadInput["contributors"]> = splitNames(authorsText).map((name, index) => ({
    name,
    role: "author",
    sortOrder: index
  }));

  const extracted: Partial<BookPayloadInput> = {
    title,
    contributors,
    publisherName,
    edition,
    publicationYear: publicationYearText ? Number(publicationYearText) : undefined,
    languageName,
    pageCount: pageCountText ? Number(pageCountText) : undefined,
    isbn13: isbn?.replace(/[^0-9Xx]/g, "")
  };

  const confidenceFields = Object.entries(extracted).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && `${value}`.trim().length > 0;
  }).length;

  const confidence = Math.min(0.88, confidenceFields / 10);

  const needsReviewFields = Object.entries(extracted)
    .filter(([, value]) => value === undefined || (Array.isArray(value) && value.length === 0))
    .map(([key]) => key);

  return {
    available: true,
    provider: "text-parser",
    confidence,
    extracted,
    needsReviewFields
  };
};
