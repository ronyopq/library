import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityPage } from "@/pages/ActivityPage";
import { ArchivedPage } from "@/pages/ArchivedPage";
import { BookDetailsPage } from "@/pages/BookDetailsPage";
import { BookFormPage } from "@/pages/BookFormPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { LoansPage } from "@/pages/LoansPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PrintLabelsPage } from "@/pages/PrintLabelsPage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/books/new" element={<BookFormPage />} />
        <Route path="/books/:id/edit" element={<BookFormPage />} />
        <Route path="/books/:id" element={<BookDetailsPage />} />
        <Route path="/loans" element={<LoansPage />} />
        <Route path="/labels" element={<PrintLabelsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/archived" element={<ArchivedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}