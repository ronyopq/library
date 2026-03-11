type DialogController = {
  alert: (message: string, title?: string) => void;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

let controller: DialogController | null = null;

export const registerDialogController = (next: DialogController | null) => {
  controller = next;
};

export const appAlert = (message: string, title = "Message") => {
  if (controller) {
    controller.alert(message, title);
    return;
  }
  window.alert(message);
};

export const appConfirm = async (message: string, title = "Please Confirm"): Promise<boolean> => {
  if (controller) {
    return controller.confirm(message, title);
  }
  return window.confirm(message);
};

