import type { BookPayloadInput } from "@shared/schemas";
import type { IsbnProviderResult } from "./types";

const choose = <T>(...values: Array<T | undefined | null>): T | undefined => values.find((value) => value !== undefined && value !== null);

export const mergeProviderMetadata = (results: IsbnProviderResult[]): Partial<BookPayloadInput> => {
  const merged: Partial<BookPayloadInput> = {
    contributors: []
  };

  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

  for (const result of sorted) {
    const candidate = result.metadata;
    merged.title = choose(merged.title, candidate.title);
    merged.subtitle = choose(merged.subtitle, candidate.subtitle);
    merged.originalTitle = choose(merged.originalTitle, candidate.originalTitle);
    merged.publisherName = choose(merged.publisherName, candidate.publisherName);
    merged.publicationYear = choose(merged.publicationYear, candidate.publicationYear);
    merged.languageName = choose(merged.languageName, candidate.languageName);
    merged.categoryName = choose(merged.categoryName, candidate.categoryName);
    merged.pageCount = choose(merged.pageCount, candidate.pageCount);
    merged.summary = choose(merged.summary, candidate.summary);
    merged.isbn10 = choose(merged.isbn10, candidate.isbn10);
    merged.isbn13 = choose(merged.isbn13, candidate.isbn13);

    if ((merged.contributors?.length ?? 0) === 0 && (candidate.contributors?.length ?? 0) > 0) {
      merged.contributors = candidate.contributors;
    }
  }

  if (sorted[0]) {
    merged.metadataSource = sorted.map((entry) => entry.source).join(", ");
    merged.metadataSourceDetails = {
      confidence: sorted[0].confidence,
      providers: sorted.map((entry) => ({ source: entry.source, confidence: entry.confidence }))
    };
  }

  return merged;
};