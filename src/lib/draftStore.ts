const DRAFT_PREFIX = "library_draft";

export const getDraftKey = (bookId?: number) => `${DRAFT_PREFIX}:${bookId ?? "new"}`;

export const saveDraft = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify({ value, savedAt: new Date().toISOString() }));
};

export const loadDraft = <T>(key: string): T | undefined => {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw).value as T;
  } catch {
    return undefined;
  }
};

export const clearDraft = (key: string) => {
  localStorage.removeItem(key);
};