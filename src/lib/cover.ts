export const resolveCoverImageUrl = (coverImageKey?: string): string | undefined => {
  if (!coverImageKey) return undefined;
  const value = coverImageKey.trim();
  if (!value) return undefined;

  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/")) {
    return value;
  }

  return `/i/${encodeURIComponent(value)}`;
};
