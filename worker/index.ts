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
  const [book, settings] = await Promise.all([getPublicBookByCode(db, shortId), getSettings(db)]);

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
  const dateAdded = new Date(book.dateAdded).toLocaleDateString("bn-BD");
  const notes = escapeHtml(book.publicNotes ?? book.summary ?? "");
  const coverUrl = book.coverImageKey ? `/i/${encodeURIComponent(book.coverImageKey)}` : "";

  const html = `<!doctype html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | ${escapeHtml(settings.libraryName)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Hind Siliguri", sans-serif;
    }
    body {
      margin: 0;
      background: radial-gradient(circle at top, #e9f7ee 0%, #f6faf7 45%, #fff 100%);
      color: #173224;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #dbeadf;
      box-shadow: 0 18px 45px -25px rgba(12, 43, 27, 0.45);
      overflow: hidden;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid #eaf2ec;
      background: linear-gradient(120deg, #ecf8f0, #f9fdfb);
    }
    .library {
      color: #2e6d4a;
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
      color: #4f6f5d;
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
      background: #eff7f1;
    }
    .meta { display: grid; gap: 10px; }
    .meta strong { color: #1f5138; }
    .code {
      margin-top: 12px;
      font-size: 13px;
      color: #516a5b;
      background: #f3f8f4;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px dashed #c8e0d1;
      display: inline-block;
    }
    .notes {
      margin: 8px 24px 24px;
      padding: 14px 16px;
      background: #f8fcf9;
      border-radius: 10px;
      border: 1px solid #e1efe4;
      white-space: pre-wrap;
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
      <div>${coverUrl ? `<img class="cover" src="${coverUrl}" alt="${title}" />` : `<div class="cover"></div>`}</div>
      <div class="meta">
        ${authors ? `<div><strong>????:</strong> ${authors}</div>` : ""}
        ${publisher ? `<div><strong>???????:</strong> ${publisher}</div>` : ""}
        ${category ? `<div><strong>????:</strong> ${category}</div>` : ""}
        ${language ? `<div><strong>????:</strong> ${language}</div>` : ""}
        <div><strong>???????? ?????:</strong> ${escapeHtml(dateAdded)}</div>
        <div class="code">???: ${escapeHtml(book.publicCode)} | Accession: ${escapeHtml(book.accessionCode)}</div>
      </div>
    </section>
    ${notes ? `<section class="notes">${notes}</section>` : ""}
  </article>
</body>
</html>`;

  return c.html(html);
});

app.get("*", async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  if (response.status !== 404) {
    return response;
  }

  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/i/") || c.req.path.startsWith("/b/")) {
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