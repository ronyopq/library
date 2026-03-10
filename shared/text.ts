export const normalizeIsbn = (value: string): string => value.replace(/[^0-9Xx]/g, "").toUpperCase();

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