const localeDigitMap: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9"
};

export const normalizeLocaleDigits = (value: string): string =>
  value.replace(/[০-৯٠-٩]/g, (digit) => localeDigitMap[digit] ?? digit);

export const parseLocalizedNumber = (value?: string | null): number | undefined => {
  const normalized = normalizeLocaleDigits((value ?? "").trim()).replace(/,/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeIsbn = (value: string): string => normalizeLocaleDigits(value).replace(/[^0-9Xx]/g, "").toUpperCase();

export const splitCsvLike = (value: string): string[] =>
  value
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);

export const joinLocation = (parts: Array<string | undefined>): string =>
  parts
    .filter((part) => !!part && part.trim().length > 0)
    .map((part) => part!.trim())
    .join(" / ");

export const nfc = (value: string): string => value.normalize("NFC");
