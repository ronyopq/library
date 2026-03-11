import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { appAlert, appConfirm } from "@/lib/appDialog";
import { getStoredAuthUser, isCurrentUserAdmin } from "@/lib/adminAuth";

interface SettingsForm {
  libraryName: string;
  publicBaseUrl: string;
  dateFormat: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  defaultLanguage: string;
  defaultCategory: string;
  publicVisibilityMode: "selected" | "all" | "off";
  labelIncludeTitle: boolean;
  labelIncludeAuthor: boolean;
  labelIncludeDate: boolean;
  labelIncludeQr: boolean;
  labelColumns: number;
  labelWidthMm: number;
  labelHeightMm: number;
}

type OptionDomain = "category" | "language" | "publisher" | "tag";

interface CatalogItem {
  id: number;
  name: string;
}

interface CatalogResponse {
  category: CatalogItem[];
  language: CatalogItem[];
  publisher: CatalogItem[];
  tag: CatalogItem[];
}

const domainLabels: Record<OptionDomain, string> = {
  category: "Categories",
  language: "Languages",
  publisher: "Publishers",
  tag: "Tags"
};
const optionDomains: OptionDomain[] = ["category", "language", "publisher", "tag"];

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [newOption, setNewOption] = useState<Record<OptionDomain, string>>({
    category: "",
    language: "",
    publisher: "",
    tag: ""
  });
  const [editing, setEditing] = useState<Record<number, string>>({});
  const currentUser = getStoredAuthUser();
  const canManageUsers = isCurrentUserAdmin();
  const canManageCatalog = isCurrentUserAdmin();

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<{ settings: SettingsForm }>("/api/settings")
  });

  const catalogQuery = useQuery({
    queryKey: ["options-catalog"],
    queryFn: () => apiRequest<CatalogResponse>("/api/options/catalog")
  });

  useEffect(() => {
    if (query.data?.settings) {
      setForm(query.data.settings);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: SettingsForm) =>
      apiRequest<{ settings: SettingsForm }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...payload,
          publicBaseUrl: payload.publicBaseUrl?.trim() || undefined,
          contactName: payload.contactName?.trim() || undefined,
          contactPhone: payload.contactPhone?.trim() || undefined,
          contactEmail: payload.contactEmail?.trim() || undefined,
          defaultLanguage: payload.defaultLanguage?.trim() || undefined,
          defaultCategory: payload.defaultCategory?.trim() || undefined
        })
      }),
    onSuccess: (result) => {
      setForm(result.settings);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  const createOptionMutation = useMutation({
    mutationFn: ({ domain, name }: { domain: OptionDomain; name: string }) =>
      apiRequest(`/api/options/catalog/${domain}`, {
        method: "POST",
        body: JSON.stringify({ name })
      }),
    onSuccess: (_, variables) => {
      setNewOption((prev) => ({ ...prev, [variables.domain]: "" }));
      queryClient.invalidateQueries({ queryKey: ["options-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["library-options"] });
    },
    onError: (error) => appAlert((error as Error).message)
  });

  const updateOptionMutation = useMutation({
    mutationFn: ({ domain, id, name }: { domain: OptionDomain; id: number; name: string }) =>
      apiRequest(`/api/options/catalog/${domain}/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name })
      }),
    onSuccess: (_, variables) => {
      setEditing((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["options-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["library-options"] });
    },
    onError: (error) => appAlert((error as Error).message)
  });

  const deleteOptionMutation = useMutation({
    mutationFn: ({ domain, id }: { domain: OptionDomain; id: number }) =>
      apiRequest(`/api/options/catalog/${domain}/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["options-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["library-options"] });
    },
    onError: (error) => appAlert((error as Error).message)
  });

  if (query.isLoading || !form || catalogQuery.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;
  if (catalogQuery.isError) {
    return <ErrorState message={(catalogQuery.error as Error).message} retry={() => catalogQuery.refetch()} />;
  }

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const catalog = catalogQuery.data;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Library Settings</h2>
        <p className="text-sm text-app-muted">Branding, public URL, print preferences, and privacy defaults.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">General</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input value={form.libraryName} onChange={(event) => update("libraryName", event.target.value)} placeholder="Library Name" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.publicBaseUrl ?? ""} onChange={(event) => update("publicBaseUrl", event.target.value)} placeholder="Public Base URL" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.dateFormat} onChange={(event) => update("dateFormat", event.target.value)} placeholder="Date Format" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <select value={form.publicVisibilityMode} onChange={(event) => update("publicVisibilityMode", event.target.value as SettingsForm["publicVisibilityMode"])} className="rounded-xl border border-app-border px-3 py-2 text-sm">
            <option value="selected">Selected books only</option>
            <option value="all">All books public by default</option>
            <option value="off">Public pages off by default</option>
          </select>
          <input value={form.contactName ?? ""} onChange={(event) => update("contactName", event.target.value)} placeholder="Contact Name" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.contactPhone ?? ""} onChange={(event) => update("contactPhone", event.target.value)} placeholder="Contact Phone" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.contactEmail ?? ""} onChange={(event) => update("contactEmail", event.target.value)} placeholder="Contact Email" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <select value={form.defaultLanguage ?? ""} onChange={(event) => update("defaultLanguage", event.target.value)} className="rounded-xl border border-app-border px-3 py-2 text-sm">
            <option value="">Default Language</option>
            {catalog?.language.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={form.defaultCategory ?? ""} onChange={(event) => update("defaultCategory", event.target.value)} className="rounded-xl border border-app-border px-3 py-2 text-sm">
            <option value="">Default Category</option>
            {catalog?.category.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Print Labels</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {[
            ["labelIncludeTitle", "Include Title"],
            ["labelIncludeAuthor", "Include Author"],
            ["labelIncludeDate", "Include Date"],
            ["labelIncludeQr", "Include QR"]
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean((form as any)[key])} onChange={(event) => update(key as keyof SettingsForm, event.target.checked as never)} />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input type="number" value={form.labelColumns} onChange={(event) => update("labelColumns", Number(event.target.value))} placeholder="Columns" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input type="number" value={form.labelWidthMm} onChange={(event) => update("labelWidthMm", Number(event.target.value))} placeholder="Width (mm)" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input type="number" value={form.labelHeightMm} onChange={(event) => update("labelHeightMm", Number(event.target.value))} placeholder="Height (mm)" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Dropdown Option Manager</h3>
        <p className="mt-1 text-sm text-app-muted">
          Admin can maintain dropdown lists for new book entry.
        </p>

        {!canManageCatalog ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Only admin can add, edit, or delete option values.
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {optionDomains.map((domain) => (
            <article key={domain} className="rounded-xl border border-app-border p-3">
              <h4 className="font-medium">{domainLabels[domain]}</h4>
              <div className="mt-2 flex gap-2">
                <input
                  value={newOption[domain]}
                  onChange={(event) => setNewOption((prev) => ({ ...prev, [domain]: event.target.value }))}
                  placeholder={`Add ${domainLabels[domain].toLowerCase()}...`}
                  className="flex-1 rounded-lg border border-app-border px-3 py-2 text-sm"
                  disabled={!canManageCatalog}
                />
                <button
                  type="button"
                  onClick={() => createOptionMutation.mutate({ domain, name: newOption[domain] })}
                  disabled={!canManageCatalog || !newOption[domain].trim() || createOptionMutation.isPending}
                  className="rounded-lg bg-app-primary px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  Add
                </button>
              </div>

              <ul className="mt-3 space-y-2 text-sm">
                {(catalog?.[domain] ?? []).map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-app-border p-2">
                    <input
                      value={editing[item.id] ?? item.name}
                      onChange={(event) => setEditing((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="flex-1 rounded border border-app-border px-2 py-1 text-sm"
                      disabled={!canManageCatalog}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateOptionMutation.mutate({
                          domain,
                          id: item.id,
                          name: (editing[item.id] ?? item.name).trim()
                        })
                      }
                      disabled={!canManageCatalog}
                      className="rounded border border-app-border px-2 py-1 text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = await appConfirm(`Delete "${item.name}"?`, "Delete Option");
                        if (!confirmed) return;
                        deleteOptionMutation.mutate({ domain, id: item.id });
                      }}
                      disabled={!canManageCatalog}
                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Current Staff Session</h3>
        <p className="mt-2 text-sm text-app-muted">
          Signed in as <strong>{currentUser?.username ?? "unknown"}</strong> ({currentUser?.role ?? "staff"}).
        </p>
        {canManageUsers ? (
          <a href="/admin/users" className="mt-3 inline-block rounded-lg border border-app-border px-3 py-2 text-sm hover:bg-app-surface">
            Manage Staff Users
          </a>
        ) : null}
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {mutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};
