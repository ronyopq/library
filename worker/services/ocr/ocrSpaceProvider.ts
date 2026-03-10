import { fetchWithTimeout } from "../../utils/timeout";
import type { OcrProvider } from "./types";
import { extractMetadataFromText } from "./textParser";

export class OcrSpaceProvider implements OcrProvider {
  name = "ocr-space";

  constructor(private readonly apiKey: string) {}

  async extract(imageDataUrl: string, languageHint?: string) {
    const form = new FormData();
    form.set("apikey", this.apiKey);
    form.set("base64Image", imageDataUrl);
    form.set("language", languageHint?.toLowerCase().includes("bn") ? "ben" : "eng");
    form.set("isTable", "false");
    form.set("scale", "true");

    const response = await fetchWithTimeout("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form
    }, 12000);

    if (!response.ok) {
      return {
        available: false,
        provider: this.name,
        message: `OCR provider error: ${response.status}`,
        confidence: 0,
        extracted: {},
        needsReviewFields: ["title", "contributors", "publisherName", "isbn13"]
      };
    }

    const payload = (await response.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string[];
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (payload.IsErroredOnProcessing) {
      return {
        available: false,
        provider: this.name,
        message: payload.ErrorMessage?.[0] ?? "OCR parse error",
        confidence: 0,
        extracted: {},
        needsReviewFields: ["title", "contributors", "publisherName", "isbn13"]
      };
    }

    const parsedText = payload.ParsedResults?.map((entry) => entry.ParsedText ?? "").join("\n") ?? "";
    const extracted = extractMetadataFromText(parsedText);

    return {
      ...extracted,
      provider: this.name,
      message: "Review suggested fields before saving."
    };
  }
}