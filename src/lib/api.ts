import type { ApiError } from "@shared/types";
import { getStoredAuthToken } from "./adminAuth";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

const buildUrl = (path: string, params?: RequestOptions["params"]) => {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { params, headers, ...rest } = options;
  const authToken = getStoredAuthToken();

  const response = await fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-auth-token": authToken,
      "x-admin-token": authToken,
      ...headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Unknown error" }))) as ApiError;
    const error = new Error(payload.error || "Request failed") as Error & { details?: unknown; status?: number };
    error.details = payload.details;
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const downloadFile = async (path: string) => {
  const authToken = getStoredAuthToken();
  const response = await fetch(path, {
    headers: {
      "x-auth-token": authToken,
      "x-admin-token": authToken
    }
  });

  if (!response.ok) {
    throw new Error("Download failed");
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const fileName = contentDisposition.match(/filename=([^;]+)/)?.[1]?.replace(/"/g, "") ?? "download.csv";

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
