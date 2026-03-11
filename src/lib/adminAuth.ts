import type { AuthUser } from "@shared/types";

const SESSION_KEY = "library_admin_session";
const TOKEN_KEY = "library_admin_token";
const USER_KEY = "library_admin_user";

export const isAdminSessionActive = (): boolean => localStorage.getItem(SESSION_KEY) === "1" && getStoredAuthToken().length > 0;

export const activateAdminSession = (token: string, user: AuthUser) => {
  localStorage.setItem(SESSION_KEY, "1");
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAdminSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredAuthToken = (): string => localStorage.getItem(TOKEN_KEY) ?? "";

export const getStoredAuthUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const isCurrentUserAdmin = (): boolean => getStoredAuthUser()?.role === "admin";
