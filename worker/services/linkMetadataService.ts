import { normalizeIsbn, splitCsvLike } from "@shared/text";
import type { BookPayloadInput } from "@shared/schemas";
import type { LinkMetadataResult } from "@shared/types";
import type { DbClient } from "../db/client";
import type { Env } from "../env";
import { metadataSources } from "../db/schema";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const trimJson = (value: unknown): string | null => {
  if (!value) return null;
  const text = JSON.stringify(value);
  if (text.length <= 30000) return text;
  return `${text.slice(0, 30000)}...`;
};

const decodeHtml = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const named = value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return named
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
};

const stripTags = (value?: string | null): string | undefined => decodeHtml(value?.replace(/<[^>]+>/g, " "));

const cleanTitle = (value?: string): string | undefined => {
  const cleaned = decodeHtml(value)?.replace(/\|\s*Rokomari\.com$/i, "").replace(/\|\s*[^|]+$/i, "").trim();
  return cleaned || undefined;
};

const toContributorList = (authorText?: string): BookPayloadInput["contributors"] => {
  if (!authorText) return [];
  return splitCsvLike(authorText).map((name, index) => ({
    name,
    role: "author" as const,
    sortOrder: index
  }));
};

const extractMatch = (html: string, pattern: RegExp): string | undefined => {
  const match = pattern.exec(html);
  return stripTags(match?.[1]);
};

const extractMeta = (html: string, keys: string[]): string | undefined => {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "i")
    ];

    for (const pattern of patterns) {
      const value = extractMatch(html, pattern);
      if (value) return value;
    }
  }
  return undefined;
};

const parseJsonLd = (html: string): Record<string, unknown>[] => {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const parsed: Record<string, unknown>[] = [];

  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw) continue;

    try {
      const value = JSON.parse(raw) as unknown;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") parsed.push(item as Record<string, unknown>);
        }
        continue;
      }

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (Array.isArray(record["@graph"])) {
          for (const item of record["@graph"] as unknown[]) {
            if (item && typeof item === "object") parsed.push(item as Record<string, unknown>);
          }
        } else {
          parsed.push(record);
        }
      }
    } catch {
      // Ignore malformed blocks from third-party pages.
    }
  }

  return parsed;
};

const parseRokomari = (html: string, url: string): LinkMetadataResult => {
  const title =
    cleanTitle(extractMeta(html, ["og:title"])) ??
    cleanTitle(extractMatch(html, /<title>([\s\S]*?)<\/title>/i));
  const ogDescription = extractMeta(html, ["og:description"]) ?? extractMeta(html, ["description"]);
  const summaryMatch = ogDescription?.match(/সার\s*সংক্ষেপ[:ঃ]?\s*([\s\S]+)$/i);
  const authorMatch = ogDescription?.match(/লেখক[:ঃ]?\s*([^,|]+)/i);
  const categoryMatch = ogDescription?.match(/ক্যাটাগরি[:ঃ]?\s*([^,|]+)/i);
  const coverImageUrl = extractMeta(html, ["og:image"]);
  const publisherName = extractMeta(html, ["product:brand"]);
  const isbn13 = extractMatch(html, /<tr>\s*<td>\s*ISBN\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/i);
  const editionLine = extractMatch(html, /<tr>\s*<td>\s*Edition\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/i);
  const pageCountRaw = extractMatch(html, /<tr>\s*<td>\s*Number of Pages\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/i);
  const publicationCountry = extractMatch(html, /<tr>\s*<td>\s*Country\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/i);
  const publicationYearMatch = editionLine?.match(/(19|20)\d{2}/);

  return {
    url,
    source: "rokomari.com",
    strategy: "rokomari-meta",
    merged: {
      title,
      isbn13: isbn13 ? normalizeIsbn(isbn13) : undefined,
      publisherName,
      categoryName: categoryMatch?.[1]?.trim() || undefined,
      publicationCountry,
      publicationYear: publicationYearMatch ? Number(publicationYearMatch[0]) : undefined,
      edition: editionLine || undefined,
      pageCount: pageCountRaw ? Number(pageCountRaw.replace(/[^\d]/g, "")) || undefined : undefined,
      summary: summaryMatch?.[1]?.trim() || ogDescription || undefined,
      metadataSource: "Rokomari",
      metadataSourceDetails: {
        sourceUrl: url,
        sourceName: "Rokomari",
        strategy: "rokomari-meta",
        coverImageUrl
      },
      coverImageKey: coverImageUrl,
      contributors: toContributorList(authorMatch?.[1]?.trim())
    }
  };
};

const readJsonLdString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readJsonLdString(record.name) ?? readJsonLdString(record["@value"]);
  }
  return undefined;
};

const readJsonLdAuthor = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value.map((item) => readJsonLdAuthor(item)).filter(Boolean).join(", ") || undefined;
  }
  return readJsonLdString(value);
};

const parseGeneric = (html: string, url: string): LinkMetadataResult => {
  const hostname = new URL(url).hostname.replace(/^www\./i, "");
  const jsonLdItems = parseJsonLd(html);
  const primaryJsonLd =
    jsonLdItems.find((item) => {
      const typeValue = item["@type"];
      const typeText = Array.isArray(typeValue) ? typeValue.join(",") : String(typeValue ?? "");
      return /book|product/i.test(typeText);
    }) ?? jsonLdItems[0];

  const jsonLdName = cleanTitle(readJsonLdString(primaryJsonLd?.name));
  const jsonLdDescription = readJsonLdString(primaryJsonLd?.description);
  const jsonLdAuthor = readJsonLdAuthor(primaryJsonLd?.author);
  const jsonLdCategory = readJsonLdString(primaryJsonLd?.category);
  const jsonLdPublisher = readJsonLdString(primaryJsonLd?.publisher) ?? readJsonLdString(primaryJsonLd?.brand);
  const jsonLdImage = readJsonLdString(primaryJsonLd?.image);

  const title =
    cleanTitle(extractMeta(html, ["og:title", "twitter:title"])) ??
    jsonLdName ??
    cleanTitle(extractMatch(html, /<title>([\s\S]*?)<\/title>/i));
  const description =
    extractMeta(html, ["og:description", "twitter:description", "description"]) ?? jsonLdDescription;
  const coverImageUrl = extractMeta(html, ["og:image", "twitter:image"]) ?? jsonLdImage;
  const isbnText =
    extractMeta(html, ["book:isbn", "books:isbn"]) ??
    extractMatch(html, />\s*ISBN(?:-13)?\s*[:<][^<]*<[^>]*>([\s\S]*?)<\/[^>]+>/i) ??
    extractMatch(html, /ISBN(?:-13)?[^0-9Xx]*([0-9Xx -]{10,20})/i);

  return {
    url,
    source: hostname,
    strategy: "generic-meta",
    merged: {
      title,
      isbn13: isbnText ? normalizeIsbn(isbnText) : undefined,
      publisherName: extractMeta(html, ["product:brand"]) ?? jsonLdPublisher,
      categoryName: jsonLdCategory,
      summary: description,
      metadataSource: hostname,
      metadataSourceDetails: {
        sourceUrl: url,
        sourceName: hostname,
        strategy: "generic-meta",
        coverImageUrl
      },
      coverImageKey: coverImageUrl,
      contributors: toContributorList(jsonLdAuthor)
    }
  };
};

const normalizeImportedMetadata = (result: LinkMetadataResult): LinkMetadataResult => ({
  ...result,
  merged: {
    ...result.merged,
    title: result.merged.title?.trim(),
    subtitle: result.merged.subtitle?.trim(),
    publisherName: result.merged.publisherName?.trim(),
    categoryName: result.merged.categoryName?.trim(),
    languageName: result.merged.languageName?.trim(),
    summary: result.merged.summary?.trim(),
    metadataSource: result.merged.metadataSource?.trim(),
    contributors:
      result.merged.contributors
        ?.map((entry) => ({
          ...entry,
          name: entry.name.trim()
        }))
        .filter((entry) => entry.name.length > 0) ?? []
  }
});

export const importMetadataFromUrl = async (env: Env, db: DbClient, inputUrl: string): Promise<LinkMetadataResult> => {
  const normalizedUrl = new URL(inputUrl).toString();
  const hostname = new URL(normalizedUrl).hostname.replace(/^www\./i, "");
  const cacheKey = `linkmeta:${encodeURIComponent(normalizedUrl)}`;

  const cached = await env.LIBRARY_KV.get<LinkMetadataResult>(cacheKey, "json");
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let html = "";
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PRAANLibraryBot/1.0; +https://praanbook.pages.dev)"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Could not fetch source page (${response.status}).`);
    }

    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const parsed = normalizeImportedMetadata(
    hostname.includes("rokomari.com") ? parseRokomari(html, normalizedUrl) : parseGeneric(html, normalizedUrl)
  );
  const hasUsefulMetadata = Boolean(
    parsed.merged.title ||
      parsed.merged.isbn13 ||
      parsed.merged.publisherName ||
      parsed.merged.categoryName ||
      parsed.merged.summary ||
      (parsed.merged.contributors?.length ?? 0) > 0
  );

  if (!hasUsefulMetadata) {
    throw new Error("No usable metadata found from this link.");
  }

  await db.insert(metadataSources).values({
    isbn: parsed.merged.isbn13 ?? parsed.merged.isbn10,
    sourceName: `link:${parsed.source}`,
    rawPayload: trimJson({
      url: normalizedUrl,
      htmlSnippet: html.slice(0, 12000)
    }),
    normalizedPayload: trimJson(parsed.merged),
    success: true
  });

  await env.LIBRARY_KV.put(cacheKey, JSON.stringify(parsed), {
    expirationTtl: CACHE_TTL_SECONDS
  });

  return parsed;
};
