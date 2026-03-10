import type { Env } from "../env";
import { MockOcrProvider } from "./ocr/mockProvider";
import { OcrSpaceProvider } from "./ocr/ocrSpaceProvider";

export const extractMetadataFromImage = async (env: Env, imageDataUrl: string, languageHint?: string) => {
  const provider = env.OCR_SPACE_API_KEY ? new OcrSpaceProvider(env.OCR_SPACE_API_KEY) : new MockOcrProvider();
  return provider.extract(imageDataUrl, languageHint);
};