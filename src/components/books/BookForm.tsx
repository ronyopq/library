import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { BookPayloadInput } from "@shared/schemas";
import type { DuplicateMatch, IsbnLookupResult, LibraryOptions, LinkMetadataResult, OcrExtractionResult } from "@shared/types";
import { normalizeIsbn, parseLocalizedNumber } from "@shared/text";
import { apiRequest } from "@/lib/api";
import { appAlert } from "@/lib/appDialog";
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
  copyCount: string;
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
  options?: LibraryOptions;
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
  copyCount: "1",
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
    copyCount: initialData.copyCount?.toString() ?? "1",
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

type ImagePickerTarget = "cover" | "ocr";

const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  return coarsePointer || /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
};

export const BookForm = ({ bookId, initialData, options, draftKey, onSaved }: BookFormProps) => {
  const coverCameraInputRef = useRef<HTMLInputElement | null>(null);
  const coverGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement | null>(null);
  const ocrGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | undefined>(resolveCoverImageUrl(initialData?.coverImageKey));
  const [coverImageKey, setCoverImageKey] = useState<string | undefined>(initialData?.coverImageKey);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [linkLookupLoading, setLinkLookupLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [metadataLink, setMetadataLink] = useState("");
  const [ocrMessage, setOcrMessage] = useState<string>("");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [pendingPayload, setPendingPayload] = useState<BookPayloadInput | null>(null);
  const [mobileImagePickerTarget, setMobileImagePickerTarget] = useState<ImagePickerTarget | null>(null);
  const [metadataSourceDetails, setMetadataSourceDetails] = useState<Record<string, unknown> | undefined>(
    initialData?.metadataSourceDetails
  );
  const [customMode, setCustomMode] = useState({
    publisherName: false,
    categoryName: false,
    languageName: false,
    format: false,
    condition: false
  });

  const form = useForm<FormValues>({
    defaultValues: mapInitialToForm(initialData)
  });

  const values = form.watch();
  const mobilePickerEnabled = isMobileDevice();

  const isCustomValue = (value: string, list: string[] | undefined) => Boolean(value && !(list ?? []).includes(value));

  const setCustomField = (
    field: "publisherName" | "categoryName" | "languageName" | "format" | "condition",
    selectedValue: string,
    list: string[] | undefined
  ) => {
    if (selectedValue === "__custom__") {
      setCustomMode((prev) => ({ ...prev, [field]: true }));
      if ((list ?? []).includes(form.getValues(field))) {
        form.setValue(field, "");
      }
      return;
    }

    setCustomMode((prev) => ({ ...prev, [field]: false }));
    form.setValue(field, selectedValue);
  };

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

  useEffect(() => {
    setCustomMode({
      publisherName: isCustomValue(form.getValues("publisherName"), options?.publishers),
      categoryName: isCustomValue(form.getValues("categoryName"), options?.categories),
      languageName: isCustomValue(form.getValues("languageName"), options?.languages),
      format: isCustomValue(form.getValues("format"), options?.formats),
      condition: isCustomValue(form.getValues("condition"), options?.conditions)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

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
      isbn10: data.isbn10 ? normalizeIsbn(data.isbn10) : undefined,
      isbn13: data.isbn13 ? normalizeIsbn(data.isbn13) : undefined,
      publisherName: data.publisherName || undefined,
      categoryName: data.categoryName || undefined,
      languageName: data.languageName || undefined,
      edition: data.edition || undefined,
      printingNumber: data.printingNumber || undefined,
      publicationYear: parseLocalizedNumber(data.publicationYear),
      publicationCountry: data.publicationCountry || undefined,
      series: data.series || undefined,
      volume: data.volume || undefined,
      pageCount: parseLocalizedNumber(data.pageCount),
      copyCount: parseLocalizedNumber(data.copyCount),
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
        price: parseLocalizedNumber(data.price),
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
        appAlert(maybeError.message || "Failed to save book");
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
      appAlert(maybeError.message || "Save failed");
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
    if (merged.coverImageKey) {
      setCoverImageKey(merged.coverImageKey);
      setCoverPreview(resolveCoverImageUrl(merged.coverImageKey));
    }

    const authorList = (merged.contributors ?? [])
      .filter((entry) => entry.role === "author")
      .map((entry) => entry.name)
      .join(", ");
    if (authorList) {
      form.setValue("authorNames", authorList);
    }
  };

  const handleLinkImport = async () => {
    if (!metadataLink.trim()) {
      appAlert("Paste a book page link first.");
      return;
    }

    setLinkLookupLoading(true);
    try {
      const result = await apiRequest<LinkMetadataResult>("/api/metadata/import-link", {
        method: "POST",
        body: JSON.stringify({ url: metadataLink.trim() })
      });
      applyMetadata(result.merged);
      setMetadataSourceDetails(result.merged.metadataSourceDetails as Record<string, unknown> | undefined);
      setOcrMessage(`Metadata imported from ${result.source}. Please review and save.`);
    } catch (error) {
      appAlert((error as Error).message);
    } finally {
      setLinkLookupLoading(false);
    }
  };

  const handleIsbnLookup = async () => {
    const isbn = normalizeIsbn(form.getValues("isbn13") || form.getValues("isbn10") || "");
    if (!isbn) {
      appAlert("Please enter an ISBN first.");
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
      appAlert(maybeError.message);
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

  const openImagePicker = (target: ImagePickerTarget) => {
    if (mobilePickerEnabled) {
      setMobileImagePickerTarget(target);
      return;
    }

    if (target === "cover") {
      coverGalleryInputRef.current?.click();
      return;
    }

    ocrGalleryInputRef.current?.click();
  };

  const chooseImageSource = (target: ImagePickerTarget, source: "camera" | "gallery") => {
    setMobileImagePickerTarget(null);
    const refs =
      target === "cover"
        ? { camera: coverCameraInputRef, gallery: coverGalleryInputRef }
        : { camera: ocrCameraInputRef, gallery: ocrGalleryInputRef };

    refs[source].current?.click();
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

  const publisherList = options?.publishers ?? [];
  const categoryList = options?.categories ?? [];
  const languageList = options?.languages ?? [];
  const formatList = options?.formats ?? [];
  const conditionList = options?.conditions ?? [];

  const publisherSelectValue =
    customMode.publisherName || isCustomValue(values.publisherName, publisherList) ? "__custom__" : values.publisherName;
  const categorySelectValue =
    customMode.categoryName || isCustomValue(values.categoryName, categoryList) ? "__custom__" : values.categoryName;
  const languageSelectValue =
    customMode.languageName || isCustomValue(values.languageName, languageList) ? "__custom__" : values.languageName;
  const formatSelectValue = customMode.format || isCustomValue(values.format, formatList) ? "__custom__" : values.format;
  const conditionSelectValue =
    customMode.condition || isCustomValue(values.condition, conditionList) ? "__custom__" : values.condition;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        ref={coverCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handleCoverSelect(event.target.files?.[0])}
      />
      <input
        ref={coverGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleCoverSelect(event.target.files?.[0])}
      />
      <input
        ref={ocrCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handleOcrFile(event.target.files?.[0])}
      />
      <input
        ref={ocrGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleOcrFile(event.target.files?.[0])}
      />

      {mobileImagePickerTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-text/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-app-border bg-white p-5 shadow-card">
            <h3 className="font-heading text-lg">Choose Image Source</h3>
            <p className="mt-2 text-sm text-app-muted">
              Use your phone camera to take a new photo, or choose an existing image from the gallery.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => chooseImageSource(mobileImagePickerTarget, "camera")}
                className="rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong"
              >
                Use Camera
              </button>
              <button
                type="button"
                onClick={() => chooseImageSource(mobileImagePickerTarget, "gallery")}
                className="rounded-xl border border-app-border px-4 py-2 text-sm hover:bg-app-surface"
              >
                Choose from Gallery
              </button>
              <button
                type="button"
                onClick={() => setMobileImagePickerTarget(null)}
                className="rounded-xl border border-app-border px-4 py-2 text-sm text-app-muted hover:bg-app-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {duplicates.length > 0 ? <DuplicateWarning duplicates={duplicates} onForceSave={handleForceSave} /> : null}

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>ISBN, Book Link, and OCR</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-2">
            <input {...form.register("isbn10")} inputMode="numeric" placeholder="ISBN-10" className={inputClass} />
            <input {...form.register("isbn13")} inputMode="numeric" placeholder="ISBN-13" className={inputClass} />
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

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={metadataLink}
            onChange={(event) => setMetadataLink(event.target.value)}
            placeholder="Paste a Rokomari or other book page link"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleLinkImport}
            disabled={linkLookupLoading}
            className="rounded-xl border border-app-border px-4 py-2 text-sm font-medium hover:bg-app-surface disabled:opacity-60"
          >
            {linkLookupLoading ? "Importing..." : "Import from Link"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openImagePicker("ocr")}
            className="inline-flex items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm hover:bg-app-surface"
          >
            OCR Image Upload
          </button>
          {ocrLoading ? <span className="text-sm text-app-muted">Running OCR...</span> : null}
          {ocrMessage ? <span className="text-sm text-app-muted">{ocrMessage}</span> : null}
        </div>
        <p className="mt-2 text-xs text-app-muted">
          Supported now: direct ISBN lookup, OCR, and book page import from sites like Rokomari. Generic book/product pages also work when metadata tags are available.
        </p>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Cover Image</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => openImagePicker("cover")}
            className="inline-flex items-center gap-2 rounded-lg border border-app-border px-3 py-2 text-sm hover:bg-app-surface"
          >
            Upload Cover
          </button>
          {coverPreview ? (
            <img src={coverPreview} alt="Cover" className="h-28 w-20 rounded-md border border-app-border object-cover" />
          ) : (
            <p className="text-sm text-app-muted">No cover uploaded yet.</p>
          )}
        </div>
        {mobilePickerEnabled ? (
          <p className="mt-2 text-xs text-app-muted">On mobile, you can choose camera or gallery before uploading.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className={sectionTitleClass}>Book Metadata</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input {...form.register("title")} placeholder="Title (recommended)" className={inputClass} />
          <input {...form.register("subtitle")} placeholder="Subtitle" className={inputClass} />
          <input {...form.register("authorNames")} placeholder="Authors (comma separated)" className={inputClass} />
          <select
            value={publisherSelectValue}
            onChange={(event) => setCustomField("publisherName", event.target.value, publisherList)}
            className={inputClass}
          >
            <option value="">Select Publisher</option>
            {publisherList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="__custom__">Custom Publisher...</option>
          </select>
          {publisherSelectValue === "__custom__" ? (
            <input {...form.register("publisherName")} placeholder="Custom Publisher" className={inputClass} />
          ) : null}

          <select
            value={categorySelectValue}
            onChange={(event) => setCustomField("categoryName", event.target.value, categoryList)}
            className={inputClass}
          >
            <option value="">Select Category</option>
            {categoryList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="__custom__">Custom Category...</option>
          </select>
          {categorySelectValue === "__custom__" ? (
            <input {...form.register("categoryName")} placeholder="Custom Category" className={inputClass} />
          ) : null}

          <select
            value={languageSelectValue}
            onChange={(event) => setCustomField("languageName", event.target.value, languageList)}
            className={inputClass}
          >
            <option value="">Select Language</option>
            {languageList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="__custom__">Custom Language...</option>
          </select>
          {languageSelectValue === "__custom__" ? (
            <input {...form.register("languageName")} placeholder="Custom Language" className={inputClass} />
          ) : null}

          <input {...form.register("publicationYear")} inputMode="numeric" placeholder="Publication Year (Bangla digits allowed)" className={inputClass} />
          <input {...form.register("pageCount")} inputMode="numeric" placeholder="Page Count (Bangla digits allowed)" className={inputClass} />
          <input {...form.register("copyCount")} inputMode="numeric" placeholder="Number of Copies" className={inputClass} />
          <input {...form.register("edition")} placeholder="Edition" className={inputClass} />
          <input {...form.register("printingNumber")} placeholder="Printing Number" className={inputClass} />
          <input {...form.register("series")} placeholder="Series" className={inputClass} />
          <input {...form.register("volume")} placeholder="Volume" className={inputClass} />

          <select
            value={formatSelectValue}
            onChange={(event) => setCustomField("format", event.target.value, formatList)}
            className={inputClass}
          >
            <option value="">Select Format</option>
            {formatList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="__custom__">Custom Format...</option>
          </select>
          {formatSelectValue === "__custom__" ? (
            <input {...form.register("format")} placeholder="Custom Format (e.g. Hardcover)" className={inputClass} />
          ) : null}

          <select
            value={conditionSelectValue}
            onChange={(event) => setCustomField("condition", event.target.value, conditionList)}
            className={inputClass}
          >
            <option value="">Select Condition</option>
            {conditionList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="__custom__">Custom Condition...</option>
          </select>
          {conditionSelectValue === "__custom__" ? (
            <input {...form.register("condition")} placeholder="Custom Condition" className={inputClass} />
          ) : null}

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
        <p className="mb-3 text-xs text-app-muted">
          Date fields are used for purchase and gift history reports. If unknown, leave them empty.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <select {...form.register("acquisitionType")} className={inputClass}>
            <option value="other">Other</option>
            <option value="purchase">Purchase</option>
            <option value="gift">Gift</option>
          </select>
          <input {...form.register("storeName")} placeholder="Store Name" className={inputClass} />
          <label className="text-sm text-app-muted">
            Purchase Date
            <input type="date" {...form.register("purchaseDate")} className={`${inputClass} mt-1`} />
          </label>
          <input {...form.register("price")} inputMode="decimal" placeholder="Price" className={inputClass} />
          <label className="text-sm text-app-muted">
            Gift Date
            <input type="date" {...form.register("giftDate")} className={`${inputClass} mt-1`} />
          </label>
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
