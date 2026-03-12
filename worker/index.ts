import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppBindings } from "./env";
import { getDb } from "./db/client";
import { apiRouter } from "./routes/api";
import { getPublicBookByCode } from "./services/bookService";
import { getImageResponse } from "./services/imageService";
import { getSettings } from "./services/settingsService";

const app = new Hono<AppBindings>();

app.use("*", logger());

app.route("/api", apiRouter);

app.get("/i/:key", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const response = await getImageResponse(c.env, key);
  if (!response) {
    return c.notFound();
  }
  return response;
});

const escapeHtml = (value?: string | null): string =>
  (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

app.get("/b/:shortId", async (c) => {
  const shortId = c.req.param("shortId");
  const db = getDb(c.env);
  const [book, settings] = await Promise.all([
    getPublicBookByCode(db, shortId, { includePrivatePhone: false }),
    getSettings(db)
  ]);

  if (!book) {
    return c.html(
      `<html><head><title>Not Found</title></head><body style="font-family: sans-serif; padding: 2rem;"><h1>Book not found</h1><p>This public link is not available.</p></body></html>`,
      404
    );
  }

  const title = escapeHtml(book.title ?? "Untitled");
  const subtitle = escapeHtml(book.subtitle ?? "");
  const authors = book.authors.map((author) => escapeHtml(author)).join(", ");
  const category = escapeHtml(book.categoryName ?? "");
  const language = escapeHtml(book.languageName ?? "");
  const publisher = escapeHtml(book.publisherName ?? "");
  const dateAdded = new Date(book.dateAdded).toLocaleDateString("en-US");
  const location = escapeHtml([book.room, book.cabinet, book.rack, book.shelf, book.positionNote].filter(Boolean).join(" / "));
  const notes = escapeHtml(book.publicNotes ?? book.summary ?? "");
  const copySummary = `${book.copyCount} copies (${book.availableCopyCount} available, ${book.borrowedCopyCount} borrowed)`;
  const activeLoansHtml = book.activeLoans.length
    ? `<div class="borrowed"><h3>Currently Borrowed</h3><ul>${book.activeLoans
        .map(
          (loan) => `<li><strong>${escapeHtml(loan.copyCode)}</strong> - ${escapeHtml(loan.borrowerName ?? "Borrower")} (${
            escapeHtml(loan.borrowerPhoneMasked ?? "hidden")
          })${loan.borrowedAt ? ` | Borrowed: ${escapeHtml(new Date(loan.borrowedAt).toLocaleDateString("en-US"))}` : ""}${
            loan.expectedReturnAt ? ` | Due: ${escapeHtml(new Date(loan.expectedReturnAt).toLocaleDateString("en-US"))}` : ""
          }</li>`
        )
        .join("")}</ul></div>`
    : "";
  const borrowHistoryHtml = book.borrowHistory.length
    ? `<div class="history"><h3>Borrow Log</h3><ul>${book.borrowHistory
        .slice(0, 20)
        .map((loan) => {
          const noteText = loan.note ? ` | ${escapeHtml(loan.note)}` : "";
          return `<li><strong>${escapeHtml(loan.copyCode ?? "-")}</strong> - ${escapeHtml(loan.borrowerName)} | Borrowed: ${escapeHtml(
            new Date(loan.borrowedAt).toLocaleDateString("en-US")
          )}${loan.returnedAt ? ` | Returned: ${escapeHtml(new Date(loan.returnedAt).toLocaleDateString("en-US"))}` : ""}${noteText}</li>`;
        })
        .join("")}</ul></div>`
    : "";
  const coverUrl = book.coverImageKey
    ? /^https?:\/\//i.test(book.coverImageKey)
      ? book.coverImageKey
      : `/i/${encodeURIComponent(book.coverImageKey)}`
    : "";
  const safeCoverUrl = escapeHtml(coverUrl);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | ${escapeHtml(settings.libraryName)}</title>
  <style>
    @font-face {
      font-family: "Akhanda Bangali";
      src: url("/fonts/Akhand_Bengali/AkhandBengali.otf") format("opentype");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
    }
    :root {
      color-scheme: light;
      font-family: "Space Grotesk", "Akhanda Bangali", sans-serif;
    }
    body {
      margin: 0;
      background: radial-gradient(circle at top, #e8eeff 0%, #f4f7ff 45%, #fff 100%);
      color: #1b2440;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #d8e0f2;
      box-shadow: 0 18px 45px -25px rgba(38, 58, 110, 0.45);
      overflow: hidden;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid #e5ebfa;
      background: linear-gradient(120deg, #eef3ff, #f9fbff);
    }
    .library {
      color: #3b5bb0;
      font-size: 14px;
      letter-spacing: 0.03em;
      margin: 0 0 8px;
    }
    .title {
      font-size: 28px;
      margin: 0;
      line-height: 1.2;
    }
    .subtitle {
      margin: 8px 0 0;
      color: #5a678d;
      font-size: 16px;
    }
    .content {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 20px;
      padding: 24px;
    }
    .cover {
      width: 180px;
      height: 250px;
      border-radius: 12px;
      object-fit: cover;
      background: #edf1fb;
    }
    .meta { display: grid; gap: 10px; }
    .meta strong { color: #2b407f; }
    .code {
      margin-top: 12px;
      font-size: 13px;
      color: #4f5c84;
      background: #eef3ff;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px dashed #cad6f7;
      display: inline-block;
    }
    .notes {
      margin: 8px 24px 24px;
      padding: 14px 16px;
      background: #f6f8ff;
      border-radius: 10px;
      border: 1px solid #e2e8fb;
      white-space: pre-wrap;
    }
    .borrowed {
      margin: 0 24px 16px;
      padding: 12px 14px;
      background: #f7f9ff;
      border: 1px solid #dfe7fb;
      border-radius: 10px;
    }
    .borrowed h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .borrowed ul,
    .history ul {
      margin: 0;
      padding: 0 0 0 18px;
      color: #3c4a70;
      font-size: 14px;
      display: grid;
      gap: 6px;
    }
    .history {
      margin: 0 24px 16px;
      padding: 12px 14px;
      background: #f8f9ff;
      border: 1px solid #e3e9fb;
      border-radius: 10px;
    }
    .history h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    @media (max-width: 680px) {
      .content {
        grid-template-columns: 1fr;
      }
      .cover {
        width: 140px;
        height: 200px;
      }
    }
  </style>
</head>
<body>
  <article class="card">
    <header class="header">
      <p class="library">${escapeHtml(settings.libraryName)}</p>
      <h1 class="title">${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
    </header>
    <section class="content">
      <div>${safeCoverUrl ? `<img class="cover" src="${safeCoverUrl}" alt="${title}" />` : `<div class="cover"></div>`}</div>
      <div class="meta">
        ${authors ? `<div><strong>Author:</strong> ${authors}</div>` : ""}
        ${publisher ? `<div><strong>Publisher:</strong> ${publisher}</div>` : ""}
        ${category ? `<div><strong>Category:</strong> ${category}</div>` : ""}
        ${language ? `<div><strong>Language:</strong> ${language}</div>` : ""}
        ${location ? `<div><strong>Shelf:</strong> ${location}</div>` : ""}
        <div><strong>Copies:</strong> ${escapeHtml(copySummary)}</div>
        <div><strong>Added On:</strong> ${escapeHtml(dateAdded)}</div>
        <div class="code">Public Code: ${escapeHtml(book.publicCode)} | Accession: ${escapeHtml(book.accessionCode)}</div>
      </div>
    </section>
    ${activeLoansHtml}
    ${borrowHistoryHtml}
    ${notes ? `<section class="notes">${notes}</section>` : ""}
  </article>
</body>
</html>`;

  return c.html(html);
});

app.get("*", async (c) => {
  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/i/") || c.req.path.startsWith("/b/")) {
    return c.notFound();
  }

  if (!c.env.ASSETS) {
    return c.text("This worker serves API and public short links only.", 404);
  }

  const response = await c.env.ASSETS.fetch(c.req.raw);
  if (response.status !== 404) {
    return response;
  }

  const acceptsHtml = c.req.header("accept")?.includes("text/html");
  if (!acceptsHtml) {
    return response;
  }

  const url = new URL(c.req.url);
  url.pathname = "/index.html";
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
});

export default app;
