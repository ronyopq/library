import { normalizeIsbn } from "@shared/text";
import type { IsbnLookupOutput } from "./isbn/types";
import type { Env } from "../env";
import type { DbClient } from "../db/client";
import { metadataSources } from "../db/schema";
import { mergeProviderMetadata } from "./isbn/merge";
import { fetchFromGoogleBooks } from "./isbn/googleBooksProvider";
import { fetchFromOpenLibrary } from "./isbn/openLibraryProvider";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const trimJson = (value: unknown): string | null => {
  if (!value) return null;
  const text = JSON.stringify(value);
  if (text.length <= 30000) return text;
  return `${text.slice(0, 30000)}...`;
};

export const lookupIsbn = async (env: Env, db: DbClient, isbnInput: string): Promise<IsbnLookupOutput> => {
  const isbn = normalizeIsbn(isbnInput);
  const cacheKey = `isbn:${isbn}`;

  const cached = await env.LIBRARY_KV.get<IsbnLookupOutput>(cacheKey, "json");
  if (cached) {
    return {
      ...cached,
      fromCache: true
    };
  }

  const providerResults = await Promise.allSettled([fetchFromOpenLibrary(isbn), fetchFromGoogleBooks(isbn)]);

  const successful = providerResults
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchFromOpenLibrary>>> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const merged = mergeProviderMetadata(successful);

  for (const provider of successful) {
    await db.insert(metadataSources).values({
      isbn,
      sourceName: provider.source,
      rawPayload: trimJson(provider.raw),
      normalizedPayload: trimJson(provider.metadata),
      success: true
    });
  }

  const output: IsbnLookupOutput = {
    isbn,
    merged,
    sources: successful,
    fromCache: false
  };

  await env.LIBRARY_KV.put(cacheKey, JSON.stringify(output), {
    expirationTtl: CACHE_TTL_SECONDS
  });

  return output;
};