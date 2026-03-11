type DialogController = {
  alert: (message: string, title?: string) => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

let controller: DialogController | null = null;

export const registerDialogController = (next: DialogController | null) => {
  controller = next;
};

const toMessageString = (message: unknown): string => {
  if (typeof message === "string") return message;
  if (message instanceof Error) return message.message || "Unknown error";
  if (message && typeof message === "object") {
    const payload = message as Record<string, unknown>;
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
    if (Array.isArray(payload.issues) && payload.issues.length > 0) {
      const firstIssue = payload.issues[0] as Record<string, unknown>;
      if (typeof firstIssue?.message === "string" && firstIssue.message.trim()) {
        return firstIssue.message;
      }
    }
    try {
      return JSON.stringify(message);
    } catch {
      return "Unknown error";
    }
  }
  if (message == null) return "Unknown error";
  return String(message);
};

export const appAlert = (message: unknown, title = "Message") => {
  const text = toMessageString(message);
  if (controller) {
    controller.alert(text, title);
    return;
  }
  window.alert(text);
};

export const appConfirm = async (message: string, title = "Please Confirm"): Promise<boolean> => {
  if (controller) {
    return controller.confirm(message, title);
  }
  return window.confirm(message);
};
