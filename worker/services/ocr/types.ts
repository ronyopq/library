import type { BookPayloadInput } from "@shared/schemas";

export interface OcrExtractionOutput {
  available: boolean;
  provider: string;
  message?: string;
  confidence: number;
  extracted: Partial<BookPayloadInput>;
  needsReviewFields: string[];
}

export interface OcrProvider {
  name: string;
  extract(imageDataUrl: string, languageHint?: string): Promise<OcrExtractionOutput>;
}