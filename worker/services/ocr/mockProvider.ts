import type { OcrProvider } from "./types";

export class MockOcrProvider implements OcrProvider {
  name = "mock";

  async extract(): Promise<import("./types").OcrExtractionOutput> {
    return {
      available: false,
      provider: this.name,
      message: "OCR provider is not configured. Please fill fields manually.",
      confidence: 0,
      extracted: {},
      needsReviewFields: ["title", "contributors", "publisherName", "isbn13"]
    };
  }
}