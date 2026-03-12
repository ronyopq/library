import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { queryClient } from "@/lib/queryClient";
import { AppDialogProvider } from "@/components/common/AppDialogProvider";
import { registerServiceWorker } from "@/lib/pwa";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppDialogProvider>
          <App />
        </AppDialogProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
