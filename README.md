# Personal Library Management (Cloudflare)

Production-ready MVP for a Bengali-friendly personal home-library system.

- Frontend: React + Vite + Tailwind + TanStack Query + Zod
- Backend: Cloudflare Workers + Hono + TypeScript
- Database: Cloudflare D1 (SQLite)
- Cache / lightweight storage: Cloudflare KV
- ORM/query layer: Drizzle ORM

## MVP Features Included

- Book add/edit with three paths:
  - Manual form
  - ISBN metadata autofill (Open Library + Google Books, merged + cached)
  - OCR-assisted fallback interface (OCR.Space provider if API key is present, graceful fallback if not)
- Cover upload with manual crop (mobile-friendly) and optimized upload flow
- Rich metadata model (contributors, acquisition info, location hierarchy, tags, notes, visibility)
- Unique ID strategy:
  - Internal `id`
  - Accession code (`LIB-YYYY-000001`)
  - Public short code (`r123`) used in `/b/:shortId`
- Duplicate warning (ISBN + similar title/author) with explicit force-save option
- Dashboard analytics (books/authors/categories/languages/borrowed/overdue/archived + distributions)
- Library cards with search/filter/sort
- Lending/borrowing workflow with overdue tracking
- Barcode + QR generation
- Label/Barcode print page with configurable fields
- Public safe book page (`/b/:shortId`) with privacy-safe field boundary
- Soft delete/archive + restore
- Activity log
- CSV export (books + loans)
- Mobile form draft auto-save in local storage
- Settings page for library branding + print defaults + public behavior

## Why This Stack For Cloudflare

- Worker + D1 + KV is native to Cloudflare and minimizes deployment friction.
- Vite static build + Worker assets binding is straightforward and low-maintenance for solo operation.
- Hono keeps Worker API clean and lightweight.
- Drizzle provides strong typing while staying practical with SQLite/D1.

## Architecture Overview

- `worker/index.ts`
  - Serves API routes under `/api/*`
  - Serves public page at `/b/:shortId`
  - Serves cover images at `/i/:key`
  - Falls back to Vite `index.html` for SPA routes
- `worker/services/*`
  - Domain services for books, loans, dashboard, settings, exports
  - ISBN and OCR provider abstractions
- `worker/db/*`
  - Drizzle schema + db client
- `drizzle/*.sql`
  - Migrations and seed SQL for D1
- `src/*`
  - Admin frontend (responsive, mobile-first)
- `shared/*`
  - Shared types + Zod schemas

## Project Structure

```text
.
+- docs/
¦  +- setup.md
¦  +- deployment.md
¦  +- future-improvements.md
+- drizzle/
¦  +- 0000_initial.sql
¦  +- 0001_seed.sql
+- shared/
+- src/
+- worker/
+- wrangler.toml
+- package.json
+- README.md
```

## Local Setup

Use [docs/setup.md](./docs/setup.md) for full setup.

Quick version:

1. Install dependencies:

```bash
npm install
```

2. Create Cloudflare resources (D1 + KV), then update `wrangler.toml` placeholders.

3. Apply database migration and seed:

```bash
npm run db:migrate:local
npm run db:seed:local
```

4. Run development servers:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Worker API: `http://localhost:8787`

## Environment

Copy `.env.example` to `.env` (local only):

- `ADMIN_TOKEN` optional admin guard for API
- `OCR_SPACE_API_KEY` optional OCR provider key
- `PUBLIC_BASE_URL` optional public URL default

## Core API Routes

- Books
  - `GET /api/books`
  - `GET /api/books/:id`
  - `POST /api/books`
  - `PUT /api/books/:id`
  - `POST /api/books/:id/archive`
  - `POST /api/books/:id/restore`
  - `POST /api/books/duplicates`
- Metadata
  - `POST /api/isbn/lookup`
  - `POST /api/ocr/extract`
- Images
  - `POST /api/images/cover`
  - `GET /i/:key`
- Lending
  - `GET /api/loans`
  - `POST /api/loans`
  - `POST /api/loans/:id/return`
- Dashboard / activity
  - `GET /api/dashboard`
  - `GET /api/activity`
- Settings / options
  - `GET /api/settings`
  - `PUT /api/settings`
  - `GET /api/options`
- Export
  - `GET /api/export/books.csv`
  - `GET /api/export/loans.csv`
- Public route
  - `GET /b/:shortId`

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run db:migrate:local
npm run db:migrate:remote
npm run db:seed:local
npm run deploy
```

## Deployment (Cloudflare)

Use [docs/deployment.md](./docs/deployment.md) for full step-by-step.

Short version:

```bash
npm run build
npm run db:migrate:remote
wrangler deploy
```

## Privacy Boundary

Public page exposes only safe fields (title/author/publisher/category/language/date/cover/public notes).

Private fields stay internal:

- purchase price
- personal notes
- loan history
- acquisition private/gift notes (unless copied into public fields)
- internal-only metadata

## Backup / Restore Guidance

- Export books CSV: `/api/export/books.csv`
- Export loans CSV: `/api/export/loans.csv`
- D1 full backup recommended via `wrangler d1 export` periodically
- Keep `.sql` migrations in Git for reproducibility

## GitHub Push Steps

```bash
git init
git add .
git commit -m "Initial personal library management app"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Known MVP Notes

- OCR is integration-ready; best results require an OCR provider key.
- Cover crop is user-assisted (clean upgrade path for AI auto-crop).
- CSV import is intentionally left for next phase; service boundaries are ready for it.

## Future Roadmap

See [docs/future-improvements.md](./docs/future-improvements.md).