import { Menu, Search } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

const navItems = [
  { to: "/", key: "nav.dashboard" },
  { to: "/library", key: "nav.library" },
  { to: "/books/new", key: "nav.addBook" },
  { to: "/loans", key: "nav.loans" },
  { to: "/labels", key: "nav.labels" },
  { to: "/activity", key: "nav.activity" },
  { to: "/settings", key: "nav.settings" },
  { to: "/archived", key: "nav.archived" }
];

export const AppShell = () => {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-[#f9fbfa] font-body text-ink-900">
      <div className="mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 gap-4 px-3 pb-8 pt-4 md:grid-cols-[250px_1fr] md:gap-6 md:px-6">
        <aside
          className={`rounded-3xl border border-brand-200/70 bg-white/90 p-4 shadow-soft backdrop-blur-md md:block ${
            open ? "block" : "hidden"
          }`}
        >
          <div className="mb-6 px-2">
            <h1 className="font-heading text-xl text-ink-900">{t("app.title")}</h1>
            <p className="mt-1 text-xs text-ink-500">Cloudflare D1 + KV</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-brand-500 text-white shadow"
                      : "text-ink-700 hover:bg-brand-100 hover:text-brand-900"
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="space-y-4">
          <header className="flex items-center justify-between rounded-2xl border border-brand-200 bg-white/80 px-4 py-3 shadow-soft backdrop-blur-md">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 px-3 py-2 text-sm md:hidden"
              onClick={() => setOpen((prev) => !prev)}
            >
              <Menu className="h-4 w-4" />
              ????
            </button>
            <div className="hidden items-center gap-2 text-sm text-ink-500 md:inline-flex">
              <Search className="h-4 w-4" />
              ????? ????? ? ???????
            </div>
            <div className="inline-flex rounded-xl border border-brand-200 bg-brand-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setLocale("bn")}
                className={`rounded-lg px-2 py-1 ${locale === "bn" ? "bg-white text-ink-900" : "text-ink-500"}`}
              >
                ?????
              </button>
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={`rounded-lg px-2 py-1 ${locale === "en" ? "bg-white text-ink-900" : "text-ink-500"}`}
              >
                EN
              </button>
            </div>
          </header>

          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};