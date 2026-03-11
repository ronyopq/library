import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { BookPayloadInput } from "@shared/schemas";
import type { DuplicateMatch, IsbnLookupResult, OcrExtractionResult } from "@shared/types";
import { apiRequest } from "@/lib/api";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draftStore";
import { resolveCoverImageUrl } from "@/lib/cover";
import { fileToDataUrl } from "@/lib/crop";
import { CoverCropper } from "./CoverCropper";
import { DuplicateWarning } from "./DuplicateWarning";

interface FormValues {
  title: string;
  subtitle: string;
  originalTitle: string;
  isbn10: string;
  isbn13: string;
  authorNames: string;
  editorNames: string;
  translatorNames: string;
  illustratorNames: string;
  publisherName: string;
  categoryName: string;
  languageName: string;
  edition: string;
  printingNumber: string;
  publicationYear: string;
  publicationCountry: string;
  series: string;
  volume: string;
  pageCount: string;
  format: string;
  condition: string;
  room: string;
  cabinet: string;
  rack: string;
  shelf: string;
  positionNote: string;
  tags: string;
  summary: string;
  personalNotes: string;
  publicNotes: string;
  isPublic: boolean;
  isFavorite: boolean;
  acquisitionType: "purchase" | "gift" | "other";
  storeName: string;
  purchaseDate: string;
  price: string;
  giftDate: string;
  giverName: string;
  giftNote: string;
  acquisitionNote: string;
  metadataSource: string;
}

interface BookFormProps {
  bookId?: number;
  initialData?: any;
  draftKey: string;
  onSaved: (id: number) => void;
}

const defaultValues: FormValues = {
  title: "",
  subtitle: "",
  originalTitle: "",
  isbn10: "",
  isbn13: "",
  authorNames: "",
  editorNames: "",
  translatorNames: "",
  illustratorNames: "",
  publisherName: "",
  categoryName: "",
  languageName: "",
  edition: "",
  printingNumber: "",
  publicationYear: "",
  publicationCountry: "",
  series: "",
  volume: "",
  pageCount: "",
  format: "",
  condition: "",
  room: "",
  cabinet: "",
  rack: "",
  shelf: "",
  positionNote: "",
  tags: "",
  summary: "",
  personalNotes: "",
  publicNotes: "",
  isPublic: false,
  isFavorite: false,
  acquisitionType: "other",
  storeName: "",
  purchaseDate: "",
  price: "",
  giftDate: "",
  giverName: "",
  giftNote: "",
  acquisitionNote: "",
  metadataSource: ""
};

const splitNames = (value: string) =>
  value
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);

const addContributors = (list: string[], role: "author" | "editor" | "translator" | "illustrator") =>
  list.map((name, index) => ({
    name,
    role,
    sortOrder: index
  }));

const mapInitialToForm = (initialData?: any): FormValues => {
  if (!initialData) return defaultValues;

  const contributors = initialData.contributors ?? [];
  const byRole = (role: string) =>
    contributors
      .filter((item: any) => item.role === role)
      .map((item: any) => item.name)
      .join(", ");

  return {
    title: initialData.title ?? "",
    subtitle: initialData.subtitle ?? "",
    originalTitle: initialData.originalTitle ?? "",
    isbn10: initialData.isbn10 ?? "",
    isbn13: initialData.isbn13 ?? "",
    authorNames: byRole("author"),
    editorNames: byRole("editor"),
    translatorNames: byRole("translator"),
    illustratorNames: byRole("illustrator"),
    publisherName: initialData.publisherName ?? "",
    categoryName: initialData.categoryName ?? "",
    languageName: initialData.languageName ?? "",
    edition: initialData.edition ?? "",
    printingNumber: initialData.printingNumber ?? "",
    publicationYear: initialData.publicationYear?.toString() ?? "",
    publicationCountry: initialData.publicationCountry ?? "",
    series: initialData.series ?? "",
    volume: initialData.volume ?? "",
    pageCount: initialData.pageCount?.toString() ?? "",
    format: initialData.format ?? "",
    condition: initialData.condition ?? "",
    room: initialData.room ?? "",
    cabinet: initialData.cabinet ?? "",
    rack: initialData.rack ?? "",
    shelf: initialData.shelf ?? "",
    positionNote: initialData.positionNote ?? "",
    tags: (initialData.tags ?? []).join(", "),
    summary: initialData.summary ?? "",
    personalNotes: initialData.personalNotes ?? "",
    publicNotes: initialData.publicNotes ?? "",
    isPublic: Boolean(initialData.isPublic),
    isFavorite: Boolean(initialData.isFavorite),
    acquisitionType: initialData.acquisition?.acquisitionType ?? "other",
    storeName: initialData.acquisition?.storeName ?? "",
    purchaseDate: initialData.acquisition?.purchaseDate ?? "",
    price: initialData.acquisition?.price?.toString() ?? "",
    giftDate: initialData.acquisition?.giftDate ?? "",
    giverName: initialData.acquisition?.giverName ?? "",
    giftNote: initialData.acquisition?.giftNote ?? "",
    acquisitionNote: initialData.acquisition?.acquisitionNote ?? "",
    metadataSource: initialData.metadataSource ?? ""
  };
};

const inputClass =
  "w-full rounded-xl border border-app-border bg-white px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:border-app-primary focus:outline-none";

export const BookForm = ({ bookId, initialData, draftKey, onSaved }: BookFormProps) => {
  const [coverPreview, setCoverPreview] = useState<string | undefined>(resolveCoverImageUrl(initialData?.coverImageKey));
  const [coverImageKey, setCoverImageKey] = useState<string | undefined>(initialData?.coverImageKey);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string>("");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [pendingPayload, setPendingPayload] = useState<BookPayloadInput | null>(null);
  const [metadataSourceDetails, setMetadataSourceDetails] = useState<Record<string, unknown> | undefined>(
    initialData?.metadataSourceDetails
  );

  const form = useForm<FormValues>({
    defaultValues: mapInitialToForm(initialData)
  });

  const values = form.watch();

  useEffect(() => {
    const drafted = loadDraft<Partial<FormValues>>(draftKey);
    if (drafted) {
      form.reset({
        ...mapInitialToForm(initialData),
        ...drafted
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      saveDraft(draftKey, values);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [values, draftKey]);

  const buildPayload = (data: FormValues, forceSave = false): BookPayloadInput => {
    const contributors = [
      ...addContributors(splitNames(data.authorNames), "author"),
      ...addContributors(splitNames(data.editorNames), "editor"),
      ...addContributors(splitNames(data.translatorNames), "translator"),
      ...addContributors(splitNames(data.illustratorNames), "illustrator")
    ];

    return {
      title: data.title || undefined,
      subtitle: data.subtitle || undefined,
      originalTitle: data.originalTitle || undefined,
      isbn10: data.isbn10 || undefined,
      isbn13: data.isbn13 || undefined,
      publisherName: data.publisherName || undefined,
      categoryName: data.categoryName || undefined,
      languageName: data.languageName || undefined,
      edition: data.edition || undefined,
      printingNumber: data.printingNumber || undefined,
      publicationYear: data.publicationYear ? Number(data.publicationYear) : undefined,
      publicationCountry: data.publicationCountry || undefined,
      series: data.series || undefined,
      volume: data.volume || undefined,
      pageCount: data.pageCount ? Number(data.pageCount) : undefined,
      format: data.format || undefined,
      condition: data.condition || undefined,
      room: data.room || undefined,
      cabinet: data.cabinet || undefined,
      rack: data.rack || undefined,
      shelf: data.shelf || undefined,
      positionNote: data.positionNote || undefined,
      tags: splitNames(data.tags),
      summary: data.summary || undefined,
      personalNotes: data.personalNotes || undefined,
      publicNotes: data.publicNotes || undefined,
      isPublic: data.isPublic,
      isFavorite: data.isFavorite,
      status: initialData?.status || "available",
      metadataSource: data.metadataSource || undefined,
      metadataSourceDetails,
      coverImageKey,
      contributors,
      acquisition: {
        acquisitionType: data.acquisitionType,
        storeName: data.storeName || undefined,
        purchaseDate: data.purchaseDate || undefined,
        price: data.price ? Number(data.price) : undefined,
        giftDate: data.giftDate || undefined,
        giverName: data.giverName || undefined,
        giftNote: data.giftNote || undefined,
        acquisitionNote: data.acquisitionNote || undefined
      },
      forceSave
    };
  };

  const persist = async (payload: BookPayloadInput) => {
    if (bookId) {
      const result = await apiRequest<{ book: { id: number } }>(`/api/books/${bookId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      return result.book.id;
    }

    const result = await apiRequest<{ book: { id: number } }>("/api/books", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return result.book.id;
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true);
    setDuplicates([]);

    const payload = buildPayload(data);

    try {
      const id = await persist(payload);
      clearDraft(draftKey);
      onSaved(id);
    } catch (error) {
      const maybeError = error as Error & { status?: number; details?: any };
      if (maybeError.status === 409 && maybeError.details?.duplicates) {
        setDuplicates(maybeError.details.duplicates as DuplicateMatch[]);
        setPendingPayload(payload);
      } else {
        alert(maybeError.message || "Failed to save book");
      }
    } finally {
      setSubmitting(false);
    }
  });

  const handleForceSave = async () => {
    if (!pendingPayload) return;
    setSubmitting(true);
    try {
      const id = await persist({ ...pendingPayload, forceSave: true });
      clearDraft(draftKey);
      onSaved(id);
    } catch (error) {
      const maybeError = error as Error;
      alert(maybeError.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const applyMetadata = (merged: Partial<BookPayloadInput>) => {
    if (merged.title) form.setValue("title", merged.title);
    if (merged.subtitle) form.setValue("subtitle", merged.subtitle);
    if (merged.publisherName) form.setValue("publisherName", merged.publisherName);
    if (merged.categoryName) form.setValue("categoryName", merged.categoryName);
    if (merged.languageName) form.setValue("languageName", merged.languageName);
    if (merged.pageCount) form.setValue("pageCount", String(merged.pageCount));
    if (merged.publicationYear) form.setValue("publicationYear", String(merged.publicationYear));
    if (merged.summary) form.setValue("summary", merged.summary);
    if (merged.isbn10) form.setValue("isbn10", merged.isbn10);
    if (merged.isbn13) form.setValue("isbn13", merged.isbn13);
    if (merged.metadataSource) form.setValue("metadataSource", merged.metadataSource);

    const authorList = (merged.contributors ?? [])
      .filter((entry) => entry.role === "author")
      .map((entry) => entry.name)
      .join(", ");
    if (authorList) {
      form.setValue("authorNames", authorList);
    }
  };

  const handleIsbnLookup = async () => {
    const isbn = form.getValues("isbn13") || form.getValues("isbn10");
    if (!isbn) {
      alert("Please enter an ISBN first.");
      return;
    }

    setLookupLoading(true);
    try {
      const result = await apiRequest<IsbnLookupResult>("/api/isbn/lookup", {
        method: "POST",
        body: JSON.stringify({ isbn })
      });
      applyMetadata(result.merged);
      setMetadataSourceDetails(result.merged.metadataSourceDetails as Record<string, unknown> | undefined);
      setOcrMessage(result.sources.length > 0 ? "ISBN metadata loaded." : "No ISBN metadata found. Use OCR/manual entry.");
    } catch (error) {
      const maybeError = error as Error;
      alert(maybeError.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleOcrFile = async (file?: File | null) => {
    if (!file) return;

    setOcrLoading(true);
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const result = await apiRequest<OcrExtractionResult>("/api/ocr/extract", {
        method: "POST",
        body: JSON.stringify({ imageDataUrl, languageHint: form.getValues("languageName") || "en" })
      });

      applyMetadata(result.extracted);
      setOcrMessage(result.message ?? "OCR suggestions applied.");
    } catch (error) {
      const maybeError = error as Error;
      setOcrMessage(maybeError.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCoverSelect = async (file?: File | null) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCropSource(dataUrl);
  };

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setCropSource(null);
    const uploaded = await apiRequest<{ key: string; url: string }>("/api/images/cover", {
      method: "POST",
      body: JSON.stringify({ imageDataUrl: croppedDataUrl })
    });
    setCoverImageKey(uploaded.key);
    setCoverPreview(uploaded.url);
  };

  const sectionTitleClass = "mb-2 font-heading text-base text-app-text";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {duplicates.length > 0 ? <DuplicateWarning duplicates={duplicates} onForceSave={handleForceSave} /> : null}

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>ISBN Autofill and OCR</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-2">
            <input {...form.register("isbn10")} placeholder="ISBN-10" className={inputClass} />
            <input {...form.register("isbn13")} placeholder="ISBN-13" className={inputClass} />
          </div>
          <button
            type="button"
            onClick={handleIsbnLookup}
            disabled={lookupLoading}
            className="rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
          >
            {lookupLoading ? "Looking up..." : "Lookup ISBN"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm">
            OCR Image Upload
            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleOcrFile(event.target.files?.[0])} />
          </label>
          {ocrLoading ? <span className="text-sm text-app-muted">Running OCR...</span> : null}
          {ocrMessage ? <span className="text-sm text-app-muted">{ocrMessage}</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Cover Image</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm">
            Upload Cover
            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleCoverSelect(event.target.files?.[0])} />
          </label>
          {coverPreview ? (
            <img src={coverPreview} alt="Cover" className="h-28 w-20 rounded-md border border-app-border object-cover" />
          ) : (
            <p className="text-sm text-app-muted">No cover uploaded yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Book Metadata</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input {...form.register("title")} placeholder="Title (recommended)" className={inputClass} />
          <input {...form.register("subtitle")} placeholder="Subtitle" className={inputClass} />
          <input {...form.register("authorNames")} placeholder="Authors (comma separated)" className={inputClass} />
          <input {...form.register("publisherName")} placeholder="Publisher" className={inputClass} />
          <input {...form.register("categoryName")} placeholder="Category" className={inputClass} />
          <input {...form.register("languageName")} placeholder="Language" className={inputClass} />
          <input {...form.register("publicationYear")} placeholder="Publication Year" className={inputClass} />
          <input {...form.register("pageCount")} placeholder="Page Count" className={inputClass} />
          <input {...form.register("edition")} placeholder="Edition" className={inputClass} />
          <input {...form.register("printingNumber")} placeholder="Printing Number" className={inputClass} />
          <input {...form.register("series")} placeholder="Series" className={inputClass} />
          <input {...form.register("volume")} placeholder="Volume" className={inputClass} />
          <input {...form.register("format")} placeholder="Format (hardcover/paperback)" className={inputClass} />
          <input {...form.register("condition")} placeholder="Condition" className={inputClass} />
          <input {...form.register("editorNames")} placeholder="Editors (comma separated)" className={inputClass} />
          <input {...form.register("translatorNames")} placeholder="Translators (comma separated)" className={inputClass} />
          <input {...form.register("illustratorNames")} placeholder="Illustrators (comma separated)" className={inputClass} />
          <input {...form.register("tags")} placeholder="Tags (comma separated)" className={inputClass} />
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Location and Notes</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input {...form.register("room")} placeholder="Room" className={inputClass} />
          <input {...form.register("cabinet")} placeholder="Cabinet / Almirah" className={inputClass} />
          <input {...form.register("rack")} placeholder="Rack" className={inputClass} />
          <input {...form.register("shelf")} placeholder="Shelf" className={inputClass} />
          <input {...form.register("positionNote")} placeholder="Position Note" className={inputClass} />
          <input {...form.register("publicationCountry")} placeholder="Publication Country" className={inputClass} />
        </div>
        <textarea {...form.register("summary")} placeholder="Summary" className={`${inputClass} mt-3 min-h-24`} />
        <textarea {...form.register("publicNotes")} placeholder="Public Notes" className={`${inputClass} mt-3 min-h-20`} />
        <textarea {...form.register("personalNotes")} placeholder="Personal Notes (private)" className={`${inputClass} mt-3 min-h-20`} />
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Acquisition</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select {...form.register("acquisitionType")} className={inputClass}>
            <option value="other">Other</option>
            <option value="purchase">Purchase</option>
            <option value="gift">Gift</option>
          </select>
          <input {...form.register("storeName")} placeholder="Store Name" className={inputClass} />
          <input type="date" {...form.register("purchaseDate")} className={inputClass} />
          <input {...form.register("price")} placeholder="Price" className={inputClass} />
          <input type="date" {...form.register("giftDate")} className={inputClass} />
          <input {...form.register("giverName")} placeholder="Giver Name" className={inputClass} />
        </div>
        <textarea {...form.register("giftNote")} placeholder="Gift Note" className={`${inputClass} mt-3 min-h-20`} />
        <textarea {...form.register("acquisitionNote")} placeholder="Acquisition Note" className={`${inputClass} mt-3 min-h-20`} />
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Visibility</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" {...form.register("isPublic")} /> Visible in public catalog
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" {...form.register("isFavorite")} /> Favorite
          </label>
        </div>
        <input {...form.register("metadataSource")} placeholder="Metadata Source" className={`${inputClass} mt-3`} />
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-xl border border-app-border bg-white/90 p-3 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            clearDraft(draftKey);
            form.reset(mapInitialToForm(initialData));
          }}
          className="rounded-lg border border-app-border px-4 py-2 text-sm"
        >
          Clear Draft
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save Book"}
        </button>
      </div>

      {cropSource ? <CoverCropper imageDataUrl={cropSource} onCancel={() => setCropSource(null)} onConfirm={handleCropConfirm} /> : null}
    </form>
  );
};
