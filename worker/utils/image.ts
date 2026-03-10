const BASE64_REGEX = /^data:(.+);base64,(.+)$/;

export interface ParsedDataUrl {
  contentType: string;
  bytes: Uint8Array;
}

export const parseDataUrl = (value: string): ParsedDataUrl => {
  const match = value.match(BASE64_REGEX);
  if (!match) {
    throw new Error("Invalid image data URL");
  }

  const [, contentType, encoded] = match;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return {
    contentType,
    bytes
  };
};

export const extensionFromContentType = (contentType: string): string => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
};