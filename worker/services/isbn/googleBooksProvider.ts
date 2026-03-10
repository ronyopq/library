import { normalizeIsbn } from "@shared/text";
import type { BookPayloadInput } from "@shared/schemas";
import { fetchWithTimeout } from "../../utils/timeout";
import type { IsbnProviderResult } from "../isbn/types";

const parsePublishedYear = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
};

const mapLanguage = (code?: string): string | undefined => {
  if (!code) return undefined;
  if (code === "bn") return "Bangla";
  if (code === "en") return "English";
  return undefined;
};

export const fetchFromGoogleBooks = async (isbnInput: string): Promise<IsbnProviderResult | null> => {
  const isbn = normalizeIsbn(isbnInput);
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;

  const response = await fetchWithTimeout(url, undefined, 6500);
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        language?: string;
        categories?: string[];
        pageCount?: number;
        description?: string;
        industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
      };
    }>;
  };

  const volume = payload.items?.[0]?.volumeInfo;
  if (!volume) {
    return null;
  }

  const isbn10 = volume.industryIdentifiers?.find((item) => item.type === "ISBN_10")?.identifier;
  const isbn13 = volume.industryIdentifiers?.find((item) => item.type === "ISBN_13")?.identifier;

  const contributors: NonNullable<BookPayloadInput["contributors"]> =
    (volume.authors ?? []).map((name, index) => ({
      name,
      role: "author",
      sortOrder: index
    })) ?? [];

  return {
    source: "google_books",
    confidence: 0.74,
    metadata: {
      title: volume.title,
      subtitle: volume.subtitle,
      contributors,
      publisherName: volume.publisher,
      publicationYear: parsePublishedYear(volume.publishedDate),
      languageName: mapLanguage(volume.language),
      categoryName: volume.categories?.[0],
      pageCount: volume.pageCount,
      summary: volume.description,
      isbn10: normalizeIsbn(isbn10 ?? isbn).slice(0, 10),
      isbn13: normalizeIsbn(isbn13 ?? isbn).slice(0, 13)
    },
    raw: volume
  };
};
