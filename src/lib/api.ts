import type { ApiError } from "@shared/types";
import { getStoredAuthToken } from "./adminAuth";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

const resolveDetailMessage = (details: unknown): string | undefined => {
  if (!details) return undefined;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) {
    const firstString = details.find((item) => typeof item === "string");
    if (typeof firstString === "string") return firstString;
    const firstObject = details.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
    if (firstObject && typeof firstObject.message === "string" && firstObject.message.trim()) {
      return firstObject.message;
    }
    return undefined;
  }
  if (typeof details === "object") {
    const record = details as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (Array.isArray(record.issues) && record.issues.length > 0) {
      const firstIssue = record.issues[0] as Record<string, unknown>;
      if (typeof firstIssue.message === "string" && firstIssue.message.trim()) {
        return firstIssue.message;
      }
    }
    if (Array.isArray(record.formErrors) && record.formErrors.length > 0) {
      const first = record.formErrors.find((item) => typeof item === "string");
      if (typeof first === "string") return first;
    }
    if (record.fieldErrors && typeof record.fieldErrors === "object") {
      const fieldErrors = record.fieldErrors as Record<string, unknown>;
      for (const value of Object.values(fieldErrors)) {
        if (Array.isArray(value) && value.length > 0) {
          const first = value.find((item) => typeof item === "string");
          if (typeof first === "string") return first;
        }
      }
    }
  }
  return undefined;
};

const resolveApiErrorMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "Request failed";
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  const errorMessage = resolveDetailMessage(record.error);
  if (errorMessage) return errorMessage;
  const issuesMessage = resolveDetailMessage(record.issues);
  if (issuesMessage) return issuesMessage;
  const detailsMessage = resolveDetailMessage(record.details);
  if (detailsMessage) return detailsMessage;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return "Request failed";
};

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
    const error = new Error(resolveApiErrorMessage(payload)) as Error & { details?: unknown; status?: number };
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
