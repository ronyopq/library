import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "library-install-banner-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24;

const isDismissedRecently = () => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(DISMISS_KEY);
  if (!stored) return false;
  const timestamp = Number(stored);
  return Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_TTL_MS;
};

const detectMobile = () => {
  if (typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
  return coarsePointer || mobileUa;
};

const detectStandalone = () => {
  if (typeof window === "undefined") return false;
  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true;
};

const detectIos = () => {
  if (typeof window === "undefined") return false;
  const platform = window.navigator.platform;
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  return /iPad|iPhone|iPod/.test(platform) || (platform === "MacIntel" && maxTouchPoints > 1);
};

export const InstallAppBanner = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);

  const isMobile = useMemo(() => detectMobile(), []);
  const isStandalone = useMemo(() => detectStandalone(), []);
  const isIos = useMemo(() => detectIos(), []);

  useEffect(() => {
    setDismissed(isDismissedRecently());
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!isMobile || isStandalone || dismissed) {
    return null;
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      dismiss();
      return;
    }

    setShowManualSteps((prev) => !prev);
  };

  return (
    <section className="mb-4 rounded-2xl border border-app-primary/20 bg-gradient-to-r from-app-primary/10 via-white to-app-primary/5 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-app-primary/10 p-2 text-app-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div>
              <h3 className="font-heading text-base text-app-text">Install this app on your phone</h3>
              <p className="text-sm text-app-muted">
                Add it to your home screen for faster login, app-style full screen use, and quick book entry.
              </p>
            </div>

            {showManualSteps ? (
              <div className="rounded-xl border border-app-border bg-white/80 px-3 py-2 text-sm text-app-muted">
                {isIos
                  ? 'On iPhone or iPad: open the browser share menu, then choose "Add to Home Screen".'
                  : 'If the install button does not open yet, use your browser menu and choose "Install App" or "Add to Home Screen".'}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleInstall();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong"
              >
                <Download className="h-4 w-4" />
                {installPrompt ? "Install App" : "Show Install Steps"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl border border-app-border px-4 py-2 text-sm hover:bg-app-surface"
              >
                Later
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-app-muted hover:bg-white"
          aria-label="Dismiss install message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};
