import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registerDialogController } from "@/lib/appDialog";

type DialogEntry = {
  kind: "alert" | "confirm";
  title: string;
  message: string;
  resolve?: (value: boolean) => void;
};

interface AppDialogProviderProps {
  children: ReactNode;
}

export const AppDialogProvider = ({ children }: AppDialogProviderProps) => {
  const [active, setActive] = useState<DialogEntry | null>(null);
  const queueRef = useRef<DialogEntry[]>([]);

  const openDialog = useCallback((entry: DialogEntry) => {
    setActive((current) => {
      if (current) {
        queueRef.current.push(entry);
        return current;
      }
      return entry;
    });
  }, []);

  const closeDialog = useCallback((result: boolean) => {
    setActive((current) => {
      if (!current) return null;
      if (current.kind === "confirm") {
        current.resolve?.(result);
      }
      return queueRef.current.shift() ?? null;
    });
  }, []);

  useEffect(() => {
    registerDialogController({
      alert: (message, title = "Message") => {
        openDialog({
          kind: "alert",
          title,
          message
        });
      },
      confirm: (message, title = "Please Confirm") =>
        new Promise<boolean>((resolve) => {
          openDialog({
            kind: "confirm",
            title,
            message,
            resolve
          });
        })
    });

    return () => {
      registerDialogController(null);
    };
  }, [openDialog]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, closeDialog]);

  return (
    <>
      {children}
      {active
        ? createPortal(
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-app-border bg-white p-5 shadow-2xl">
                <h3 className="font-heading text-lg text-app-text">{active.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-app-muted">{active.message}</p>
                <div className="mt-5 flex justify-end gap-2">
                  {active.kind === "confirm" ? (
                    <button
                      type="button"
                      onClick={() => closeDialog(false)}
                      className="rounded-lg border border-app-border px-4 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => closeDialog(true)}
                    className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white"
                  >
                    {active.kind === "confirm" ? "Confirm" : "OK"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

