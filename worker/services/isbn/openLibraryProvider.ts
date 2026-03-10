import { normalizeIsbn } from "@shared/text";
import type { BookPayloadInput } from "@shared/schemas";
import { fetchWithTimeout } from "../../utils/timeout";
import type { IsbnProviderResult } from "../isbn/types";

const parseYear = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
};

const detectLanguage = (key?: string): string | undefined => {
  if (!key) return undefined;
  if (key.includes("ben")) return "Bangla";
  if (key.includes("eng")) return "English";
  return undefined;
};

export const fetchFromOpenLibrary = async (isbnInput: string): Promise<IsbnProviderResult | null> => {
  const isbn = normalizeIsbn(isbnInput);
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`;
  const response = await fetchWithTimeout(url, undefined, 6500);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, any>;
  const book = payload[`ISBN:${isbn}`];
  if (!book) {
    return null;
  }

  const contributors: NonNullable<BookPayloadInput["contributors"]> =
    (book.authors ?? []).map((author: { name?: string }, index: number) => ({
      name: (author.name ?? "").trim(),
      role: "author",
      sortOrder: index
    })) ?? [];

  const metadata: Partial<BookPayloadInput> = {
    title: book.title,
    subtitle: book.subtitle,
    contributors: contributors.filter((item) => item.name.length > 0),
    publisherName: book.publishers?.[0]?.name,
    publicationYear: parseYear(book.publish_date),
    languageName: detectLanguage(book.languages?.[0]?.key),
    categoryName: book.subjects?.[0]?.name,
    pageCount: book.number_of_pages,
    isbn10: normalizeIsbn(book.identifiers?.isbn_10?.[0] ?? isbn).slice(0, 10),
    isbn13: normalizeIsbn(book.identifiers?.isbn_13?.[0] ?? isbn).slice(0, 13),
    summary: typeof book.notes === "string" ? book.notes : undefined
  };

  return {
    source: "openlibrary",
    confidence: 0.86,
    metadata,
    raw: book
  };
};
