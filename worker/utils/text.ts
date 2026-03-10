export const normalizeUnicode = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const normalized = value.normalize("NFC").trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeKey = (value?: string | null): string | undefined => {
  const text = normalizeUnicode(value);
  if (!text) return undefined;
  return text.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
};

export const normalizeTitleSearch = (value?: string | null): string | undefined => {
  const text = normalizeUnicode(value);
  if (!text) return undefined;
  return text
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const ensureArray = <T>(input?: T[] | null): T[] => (Array.isArray(input) ? input : []);

export const compact = <T>(values: Array<T | null | undefined>): T[] => values.filter((value): value is T => value !== undefined && value !== null);

export const parseJsonSafely = <T>(value?: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

export const toISODateTime = (value?: string | null): string => {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};

export const joinNonEmpty = (parts: Array<string | undefined>): string =>
  parts
    .filter((item) => !!item)
    .map((item) => item!.trim())
    .filter(Boolean)
    .join(" / ");