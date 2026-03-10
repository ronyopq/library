import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { isAdminSessionActive } from "@/lib/adminAuth";
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
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { PublicBookPage } from "@/pages/public/PublicBookPage";
import { PublicCatalogPage } from "@/pages/public/PublicCatalogPage";

const AdminGuard = () => {
  if (!isAdminSessionActive()) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicCatalogPage />} />
        <Route path="/book/:shortCode" element={<PublicBookPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/library" element={<LibraryPage />} />
          <Route path="/admin/books/new" element={<BookFormPage />} />
          <Route path="/admin/books/:id/edit" element={<BookFormPage />} />
          <Route path="/admin/books/:id" element={<BookDetailsPage />} />
          <Route path="/admin/loans" element={<LoansPage />} />
          <Route path="/admin/labels" element={<PrintLabelsPage />} />
          <Route path="/admin/activity" element={<ActivityPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/archived" element={<ArchivedPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}