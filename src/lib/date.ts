import { format } from "date-fns";

export const formatDate = (value?: string | null, fallback = "-") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, "yyyy-MM-dd");
};

export const isOverdue = (expectedReturnAt?: string | null, status?: string) => {
  if (!expectedReturnAt || status !== "borrowed") return false;
  return new Date(expectedReturnAt).getTime() < Date.now();
};