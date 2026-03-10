const SESSION_KEY = "library_admin_session";
const TOKEN_KEY = "library_admin_token";

export const isAdminSessionActive = (): boolean => localStorage.getItem(SESSION_KEY) === "1";

export const activateAdminSession = (token: string) => {
  localStorage.setItem(SESSION_KEY, "1");
  localStorage.setItem(TOKEN_KEY, token.trim());
};

export const clearAdminSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const getStoredAdminToken = (): string => localStorage.getItem(TOKEN_KEY) ?? "";
