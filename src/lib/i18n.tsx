import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { messages, type Locale } from "@/i18n/messages";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>((localStorage.getItem("library_locale") as Locale) || "bn");

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocale(next);
        localStorage.setItem("library_locale", next);
      },
      t: (key) => messages[locale][key] ?? messages.en[key] ?? key
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
};