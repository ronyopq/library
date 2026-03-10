import { BookOpenText, Boxes, LayoutDashboard, LogOut, Printer, ScrollText, Settings, UsersRound } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAdminSession } from "@/lib/adminAuth";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/library", label: "Library", icon: BookOpenText },
  { to: "/admin/books/new", label: "Add Book", icon: Boxes },
  { to: "/admin/loans", label: "Loans", icon: UsersRound },
  { to: "/admin/labels", label: "Print Labels", icon: Printer },
  { to: "/admin/activity", label: "Activity", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings }
];

export const AdminLayout = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 gap-4 px-3 py-4 md:grid-cols-[270px_1fr] md:px-6">
        <aside className={`rounded-3xl border border-app-border bg-white p-4 shadow-card ${open ? "block" : "hidden md:block"}`}>
          <div className="mb-6 px-2">
            <p className="text-xs uppercase tracking-[0.16em] text-app-muted">Admin Panel</p>
            <h1 className="mt-2 font-heading text-xl text-app-text">Personal Library</h1>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                      isActive ? "bg-app-primary text-white" : "text-app-text hover:bg-app-surface"
                    }`
                  }
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
            <NavLink
              to="/admin/archived"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                  isActive ? "bg-app-primary text-white" : "text-app-text hover:bg-app-surface"
                }`
              }
              onClick={() => setOpen(false)}
            >
              <Boxes className="h-4 w-4" />
              Archived
            </NavLink>
          </nav>

          <button
            type="button"
            onClick={() => {
              clearAdminSession();
              navigate("/admin/login");
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-xs text-app-muted hover:bg-app-surface"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </aside>

        <div className="space-y-4">
          <header className="flex items-center justify-between rounded-2xl border border-app-border bg-white px-4 py-3 shadow-card">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="rounded-lg border border-app-border px-3 py-1.5 text-sm md:hidden"
            >
              Menu
            </button>
            <p className="text-sm text-app-muted">Manage books, loans, archives, and public visibility.</p>
            <a href="/" className="rounded-lg border border-app-border px-3 py-1.5 text-xs hover:bg-app-surface">
              Public Catalog
            </a>
          </header>

          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};