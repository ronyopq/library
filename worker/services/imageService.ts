import type { Env } from "../env";
import { extensionFromContentType, parseDataUrl } from "../utils/image";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export const storeCoverImage = async (env: Env, imageDataUrl: string): Promise<{ key: string; url: string }> => {
  const { bytes, contentType } = parseDataUrl(imageDataUrl);

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Please use an image below 3MB.");
  }

  const extension = extensionFromContentType(contentType);
  const key = `cover:${crypto.randomUUID()}.${extension}`;

  await env.LIBRARY_KV.put(key, bytes, {
    metadata: {
      contentType
    }
  });

  return {
    key,
    url: `/i/${encodeURIComponent(key)}`
  };
};

export const getImageResponse = async (env: Env, key: string): Promise<Response | null> => {
  const result = await env.LIBRARY_KV.getWithMetadata<{ contentType?: string }>(key, "arrayBuffer");

  if (!result.value) {
    return null;
  }

  return new Response(result.value, {
    headers: {
      "content-type": result.metadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
};
