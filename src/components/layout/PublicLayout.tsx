import { Download, Heart, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import type { PublicSiteSettings } from "@shared/types";
import { apiRequest } from "@/lib/api";
import { resolveCoverImageUrl } from "@/lib/cover";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const upsertMetaTag = (name: string, content: string) => {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
};

const upsertPropertyMetaTag = (property: string, content: string) => {
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.content = content;
};

const upsertLinkTag = (rel: string, href: string) => {
  let tag = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
};

export const PublicLayout = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["public-site-settings"],
    queryFn: () => apiRequest<{ settings: PublicSiteSettings }>("/api/public/settings")
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    const title = settings?.siteMetaTitle || settings?.libraryName || "Library Catalog";
    const description = settings?.siteMetaDescription || "Personal library catalog and barcode access.";

    document.title = title;
    upsertMetaTag("description", description);
    upsertMetaTag("apple-mobile-web-app-title", title);
    upsertMetaTag("mobile-web-app-capable", "yes");
    upsertMetaTag("theme-color", "#365fcf");
    upsertPropertyMetaTag("og:title", title);
    upsertPropertyMetaTag("og:description", description);
    upsertLinkTag("manifest", "/api/public/manifest.webmanifest");
    upsertLinkTag("icon", "/api/public/icon");
    upsertLinkTag("apple-touch-icon", "/api/public/icon");
  }, [settingsQuery.data]);

  const settings = settingsQuery.data?.settings;
  const logoUrl = resolveCoverImageUrl(settings?.logoImageKey);

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <header className="border-b border-app-border bg-white/95">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={settings?.libraryName || "Library logo"} className="h-12 w-12 rounded-2xl border border-app-border object-cover" />
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-app-muted">Public Catalog</p>
              <h1 className="font-heading text-2xl">{settings?.libraryName || "Personal Library"}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {installPrompt ? (
              <button
                type="button"
                onClick={async () => {
                  await installPrompt.prompt();
                  await installPrompt.userChoice;
                  setInstallPrompt(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-app-border px-4 py-2 text-sm hover:bg-app-surface"
              >
                <Download className="h-4 w-4" />
                Install App
              </button>
            ) : null}
            <a
              href="/admin/login"
              className="rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-app-primary-strong"
            >
              Admin Login
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-app-border bg-white/95">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-5 text-sm text-app-muted md:px-6">
          {settings?.contactAddress || settings?.contactPhone || settings?.contactName ? (
            <div className="flex flex-wrap items-center gap-4">
              {settings.contactAddress ? (
                <p className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4" />
                  <span>{settings.contactAddress}</span>
                </p>
              ) : null}
              {settings.contactPhone ? (
                <p className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{settings.contactPhone}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="inline-flex flex-wrap items-center gap-2">
            <span>Made with</span>
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
            <span>by</span>
            <a href="https://fb.co/RonySiddiqi" target="_blank" rel="noreferrer" className="text-app-primary hover:underline">
              RONY
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};
