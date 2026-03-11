import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const DEFAULT_FILE = "C:/Users/ronyo/Downloads/Booklist_PRAAN_2026.xlsx";
const BASE_URL = process.env.IMPORT_BASE_URL ?? "https://library-6ny.pages.dev";
const ADMIN_USERNAME = process.env.IMPORT_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.IMPORT_ADMIN_PASSWORD ?? "Admin@1234";
const EXCEL_PATH = process.argv[2] ?? DEFAULT_FILE;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const parseCount = (value) => {
  const numeric = Number.parseInt(clean(value), 10);
  if (Number.isNaN(numeric) || numeric <= 0) return 1;
  return Math.min(50, numeric);
};

const mapLanguage = (value) => {
  const source = clean(value);
  const key = source.toLowerCase();
  if (!source || key === "language") return undefined;
  if (source === "বাংলা") return "Bangla";
  if (source === "ইংরেজী") return "English";
  if (key === "bangla" || key === "bengali") return "Bangla";
  if (key === "english") return "English";
  return source;
};

const mapStatus = (value) => {
  const key = clean(value).toLowerCase();
  if (!key) return "available";
  if (key.includes("borrow")) return "borrowed";
  if (key.includes("lost")) return "lost";
  return "available";
};

const splitAuthors = (value) =>
  clean(value)
    .replace(/\s+ও\s+/g, ",")
    .replace(/\s+and\s+/gi, ",")
    .replace(/\s*&\s*/g, ",")
    .split(/[,;/]/g)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeMatch = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^0-9a-z\u0980-\u09ff ]+/g, " ")
    .replace(/\s+/g, " ");

const titleScore = (left, right) => {
  const a = normalizeMatch(left);
  const b = normalizeMatch(right);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.length > 4 && (a.includes(b) || b.includes(a))) return 2;
  const aTokens = a.split(" ").filter(Boolean);
  const bTokens = b.split(" ").filter(Boolean);
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
  if (overlap >= Math.max(2, Math.ceil(Math.min(aTokens.length, bTokens.length) / 2))) return 1;
  return 0;
};

const authorScore = (wantedAuthorList, candidateAuthorList) => {
  if (!wantedAuthorList.length || !candidateAuthorList.length) return 0;
  const wanted = wantedAuthorList.map(normalizeMatch);
  const candidate = candidateAuthorList.map(normalizeMatch);
  for (const target of wanted) {
    if (!target) continue;
    if (candidate.some((value) => value.includes(target) || target.includes(value))) {
      return 2;
    }
  }
  return 0;
};

const pickIsbn = (values, wantedLength) => {
  if (!Array.isArray(values)) return undefined;
  for (const raw of values) {
    const normalized = clean(raw).replace(/[^0-9Xx]/g, "").toUpperCase();
    if (normalized.length === wantedLength) return normalized;
  }
  return undefined;
};

const parseYear = (value) => {
  const text = clean(value);
  const match = text.match(/\b(1[6-9]\d{2}|20\d{2}|2100)\b/);
  return match ? Number.parseInt(match[1], 10) : undefined;
};

const languageByCode = (code) => {
  const key = clean(code).toLowerCase();
  if (!key) return undefined;
  if (key === "eng" || key === "en") return "English";
  if (key === "ben" || key === "bn") return "Bangla";
  return undefined;
};

const fetchJsonWithTimeout = async (url, timeoutMs = 4200) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const lookupOpenLibrary = async (book) => {
  const authorHint = book.authors[0] ?? "";
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(authorHint)}&limit=5`;
  const payload = await fetchJsonWithTimeout(url, 4200);
  if (!payload?.docs?.length) return null;

  let best = null;
  let bestScore = -1;

  for (const doc of payload.docs.slice(0, 5)) {
    const currentTitle = clean(doc.title);
    const currentAuthors = Array.isArray(doc.author_name) ? doc.author_name.map((item) => clean(item)).filter(Boolean) : [];
    const score = titleScore(book.title, currentTitle) + authorScore(book.authors, currentAuthors) + (Array.isArray(doc.isbn) ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }

  if (!best || bestScore < 2) {
    return null;
  }

  const isbn13 = pickIsbn(best.isbn, 13);
  const isbn10 = pickIsbn(best.isbn, 10);
  const publicationYear = Number.isInteger(best.first_publish_year) ? best.first_publish_year : undefined;
  const publisherName = Array.isArray(best.publisher) ? clean(best.publisher[0]) : undefined;
  const coverImageKey = best.cover_i ? `https://covers.openlibrary.org/b/id/${best.cover_i}-L.jpg` : undefined;
  const languageName = Array.isArray(best.language) ? languageByCode(best.language[0]) : undefined;

  return {
    provider: "openlibrary",
    score: bestScore,
    isbn13,
    isbn10,
    publicationYear,
    publisherName: publisherName || undefined,
    coverImageKey,
    languageName,
    raw: {
      key: best.key,
      title: best.title,
      author_name: best.author_name,
      first_publish_year: best.first_publish_year,
      publisher: best.publisher,
      language: best.language,
      cover_i: best.cover_i
    }
  };
};

const latinRatio = (value) => {
  const text = clean(value);
  if (!text) return 0;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return latin / text.length;
};

const lookupGoogleBooks = async (book) => {
  if (latinRatio(book.title) < 0.35) return null;

  const authorHint = book.authors[0] ?? "";
  const query = `intitle:${book.title}${authorHint ? `+inauthor:${authorHint}` : ""}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&printType=books`;
  const payload = await fetchJsonWithTimeout(url, 4200);
  if (!payload?.items?.length) return null;

  let best = null;
  let bestScore = -1;

  for (const item of payload.items.slice(0, 3)) {
    const info = item.volumeInfo ?? {};
    const candidateTitle = clean(info.title);
    const candidateAuthors = Array.isArray(info.authors) ? info.authors.map((value) => clean(value)).filter(Boolean) : [];
    const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const score = titleScore(book.title, candidateTitle) + authorScore(book.authors, candidateAuthors) + (identifiers.length > 0 ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (!best || bestScore < 2) return null;

  const info = best.volumeInfo ?? {};
  const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
  const isbn13 =
    ids.find((item) => item.type === "ISBN_13")?.identifier?.replace(/[^0-9Xx]/g, "").toUpperCase() ||
    pickIsbn(ids.map((item) => item.identifier), 13);
  const isbn10 =
    ids.find((item) => item.type === "ISBN_10")?.identifier?.replace(/[^0-9Xx]/g, "").toUpperCase() ||
    pickIsbn(ids.map((item) => item.identifier), 10);

  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
  const coverImageKey = thumb ? thumb.replace(/^http:\/\//i, "https://") : undefined;
  const summary = clean(info.description).slice(0, 4800) || undefined;
  const publicationYear = parseYear(info.publishedDate);

  return {
    provider: "google-books",
    score: bestScore,
    isbn13,
    isbn10,
    publicationYear,
    publisherName: clean(info.publisher) || undefined,
    subtitle: clean(info.subtitle) || undefined,
    pageCount: Number.isInteger(info.pageCount) ? info.pageCount : undefined,
    languageName: languageByCode(info.language),
    summary,
    coverImageKey,
    raw: {
      id: best.id,
      title: info.title,
      subtitle: info.subtitle,
      authors: info.authors,
      publisher: info.publisher,
      publishedDate: info.publishedDate,
      pageCount: info.pageCount,
      language: info.language
    }
  };
};

const parseWorkbook = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const headerIndex = rows.findIndex((row) => clean(row[2]).toLowerCase() === "book title");
  if (headerIndex < 0) {
    throw new Error("Could not detect header row in Excel sheet.");
  }

  const parsed = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const title = clean(row[2]);
    if (!title) continue;

    const categoryName = clean(row[5]);
    const mappedCategory = categoryName.toLowerCase() === "subject" ? undefined : categoryName;

    parsed.push({
      excelRowNumber: index + 1,
      sourceSerial: clean(row[0]),
      sourceBookId: clean(row[1]),
      title,
      authors: splitAuthors(row[3]),
      publisherName: clean(row[4]) || undefined,
      categoryName: mappedCategory || undefined,
      languageName: mapLanguage(row[6]),
      copyCount: parseCount(row[7]),
      status: mapStatus(row[8])
    });
  }

  return {
    sheetName,
    items: parsed
  };
};

const login = async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  if (!payload?.token) {
    throw new Error("Login succeeded but token was missing.");
  }
  return payload.token;
};

const createBook = async (token, payload) => {
  const response = await fetch(`${BASE_URL}/api/books`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-token": token,
      "x-admin-token": token
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, body };

  if (response.status === 409) {
    const retry = await fetch(`${BASE_URL}/api/books`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-token": token,
        "x-admin-token": token
      },
      body: JSON.stringify({
        ...payload,
        forceSave: true
      })
    });

    const retryBody = await retry.json().catch(() => ({}));
    if (retry.ok) return { ok: true, body: retryBody, forced: true };
    return { ok: false, status: retry.status, body: retryBody };
  }

  return { ok: false, status: response.status, body };
};

const mergePayload = (book, onlineMetadata) => {
  const contributors = book.authors.map((name, index) => ({
    name,
    role: "author",
    sortOrder: index
  }));

  const merged = {
    title: book.title,
    publisherName: book.publisherName,
    categoryName: book.categoryName,
    languageName: book.languageName,
    copyCount: book.copyCount,
    status: book.status,
    isPublic: true,
    isFavorite: false,
    contributors,
    tags: [],
    acquisition: {
      acquisitionType: "other"
    },
    metadataSource: "excel-import",
    metadataSourceDetails: {
      excel: {
        rowNumber: book.excelRowNumber,
        serial: book.sourceSerial || undefined,
        sourceBookId: book.sourceBookId || undefined
      }
    }
  };

  if (!onlineMetadata) return merged;

  if (!merged.publisherName && onlineMetadata.publisherName) merged.publisherName = onlineMetadata.publisherName;
  if (!merged.languageName && onlineMetadata.languageName) merged.languageName = onlineMetadata.languageName;
  if (onlineMetadata.isbn10) merged.isbn10 = onlineMetadata.isbn10;
  if (onlineMetadata.isbn13) merged.isbn13 = onlineMetadata.isbn13;
  if (onlineMetadata.publicationYear) merged.publicationYear = onlineMetadata.publicationYear;
  if (onlineMetadata.pageCount) merged.pageCount = onlineMetadata.pageCount;
  if (onlineMetadata.subtitle) merged.subtitle = onlineMetadata.subtitle;
  if (onlineMetadata.summary) merged.summary = onlineMetadata.summary;
  if (onlineMetadata.coverImageKey) merged.coverImageKey = onlineMetadata.coverImageKey;

  merged.metadataSource = `excel-import + ${onlineMetadata.provider}`;
  merged.metadataSourceDetails.online = {
    provider: onlineMetadata.provider,
    score: onlineMetadata.score,
    raw: onlineMetadata.raw
  };

  return merged;
};

const main = async () => {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found: ${EXCEL_PATH}`);
  }

  const parsed = parseWorkbook(EXCEL_PATH);
  if (parsed.items.length === 0) {
    throw new Error("No book rows found in the Excel file.");
  }

  console.log(`Found ${parsed.items.length} books in "${path.basename(EXCEL_PATH)}" (sheet: ${parsed.sheetName})`);
  console.log(`Target API: ${BASE_URL}`);

  const token = await login();
  console.log("Admin login successful. Starting import...");

  let created = 0;
  let enriched = 0;
  let forced = 0;
  const failed = [];

  for (let index = 0; index < parsed.items.length; index += 1) {
    const item = parsed.items[index];

    let onlineMetadata = await lookupOpenLibrary(item);
    if (!onlineMetadata) {
      onlineMetadata = await lookupGoogleBooks(item);
    }

    if (onlineMetadata) {
      enriched += 1;
    }

    const payload = mergePayload(item, onlineMetadata);
    const result = await createBook(token, payload);

    if (result.ok) {
      created += 1;
      if (result.forced) forced += 1;
      console.log(`[${index + 1}/${parsed.items.length}] imported: ${item.title}`);
    } else {
      failed.push({
        index: index + 1,
        title: item.title,
        status: result.status,
        error: result.body?.error ?? "unknown error",
        details: result.body?.details
      });
      console.log(`[${index + 1}/${parsed.items.length}] failed: ${item.title} (${result.status})`);
    }

    await new Promise((resolve) => setTimeout(resolve, 90));
  }

  console.log("");
  console.log("Import complete");
  console.log(`- Total rows: ${parsed.items.length}`);
  console.log(`- Created: ${created}`);
  console.log(`- Enriched from online sources: ${enriched}`);
  console.log(`- Force-saved duplicates: ${forced}`);
  console.log(`- Failed: ${failed.length}`);

  if (failed.length > 0) {
    const failPath = path.join(process.cwd(), "scripts", "import_failures.json");
    fs.writeFileSync(failPath, JSON.stringify(failed, null, 2), "utf8");
    console.log(`Failure log written: ${failPath}`);
  }
};

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});

