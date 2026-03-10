# Personal Library Management (Cloudflare)

Production-ready MVP for a personal home-library system with clean admin/public separation.

- Frontend: React + Vite + Tailwind + TanStack Query + Zod
- Backend: Cloudflare Workers + Hono + TypeScript
- Database: Cloudflare D1 (SQLite)
- Cache / lightweight storage: Cloudflare KV
- ORM/query layer: Drizzle ORM

## Product Model

- Public side (read-only): browse and search public books by title/author/code/shelf location
- Admin side (authenticated by token): add/edit/archive/restore/delete books, manage loans, settings, labels, activity
- Short public book links: `/b/r123`

## MVP Features Included

- Book add/edit workflows:
  - Manual form
  - ISBN metadata autofill (Open Library + Google Books, merged + cached)
  - OCR-assisted fallback interface (OCR.Space provider if API key exists, manual fallback otherwise)
- Cover upload with manual crop (mobile-friendly)
- Rich metadata model (contributors, acquisition info, location hierarchy, tags, notes, visibility)
- Unique IDs:
  - Internal numeric ID
  - Accession code (`LIB-YYYY-000001`)
  - Public short code (`r123`)
- Duplicate warning (ISBN + similar title/author) with explicit force-save option
- Dashboard analytics (books/authors/categories/languages/borrowed/overdue/archived + distributions)
- Library cards with search/filter/sort
- Lending/borrowing workflow with overdue tracking
- Barcode + QR generation
- Label print page with configurable fields
- Public safe book page (`/b/:shortId`) with privacy-safe field boundary
- Soft delete (archive) + restore + protected permanent delete
- Activity log
- CSV export (books + loans)
- Mobile form draft auto-save in local storage
- Settings page for library branding + print defaults + public behavior

## Why This Stack For Cloudflare

- Worker + D1 + KV is native to Cloudflare and minimizes deployment friction.
- Vite static build + Worker assets binding is straightforward for solo maintenance.
- Hono keeps Worker APIs lightweight.
- Drizzle gives practical type safety for D1/SQLite.

## Architecture Overview

- `worker/index.ts`
  - Serves API under `/api/*`
  - Serves public short page at `/b/:shortId`
  - Serves cover images at `/i/:key`
  - Falls back to Vite `index.html` for SPA routes (`/`, `/admin/*`)
- `worker/services/*`
  - Domain services (books, loans, dashboard, settings, exports)
  - ISBN and OCR provider abstractions
- `worker/db/*`
  - Drizzle schema + db client
- `drizzle/*.sql`
  - Migrations and seed SQL for D1
- `src/*`
  - React frontend for public catalog + admin panel
- `shared/*`
  - Shared types + Zod schemas

## Project Structure

```text
.
|-- docs/
|   |-- setup.md
|   |-- deployment.md
|   `-- future-improvements.md
|-- drizzle/
|   |-- 0000_initial.sql
|   `-- 0001_seed.sql
|-- shared/
|-- src/
|-- worker/
|-- wrangler.toml
|-- package.json
`-- README.md
```

## Local Setup

Full instructions: [docs/setup.md](./docs/setup.md)

Quick start:

1. Install dependencies:

```bash
npm install
```

2. Create Cloudflare resources (D1 + KV), then update `wrangler.toml` bindings.

3. Apply local migration and seed:

```bash
npm run db:migrate:local
npm run db:seed:local
```

4. Run development:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Worker API: `http://localhost:8787`

## Environment Variables

Copy `.env.example` to `.env` for local use.

- `ADMIN_TOKEN` optional admin guard for admin APIs
- `OCR_SPACE_API_KEY` optional OCR provider key
- `PUBLIC_BASE_URL` optional default base URL for QR/public links

## Routes

- Public SPA:
  - `/` catalog
  - `/book/:shortCode` public React detail page
- Public short route:
  - `/b/:shortId` lightweight public HTML page for QR links
- Admin SPA:
  - `/admin/login`
  - `/admin/*`

## Core API Routes

- Public APIs (no admin token required):
  - `GET /api/public/books`
  - `GET /api/public/books/:shortCode`
  - `GET /api/public/summary`
- Admin book APIs:
  - `GET /api/books`
  - `GET /api/books/:id`
  - `POST /api/books`
  - `PUT /api/books/:id`
  - `POST /api/books/:id/archive`
  - `POST /api/books/:id/restore`
  - `DELETE /api/books/:id` (permanent delete)
  - `POST /api/books/duplicates`
- Metadata:
  - `POST /api/isbn/lookup`
  - `POST /api/ocr/extract`
- Images:
  - `POST /api/images/cover`
  - `GET /i/:key`
- Lending:
  - `GET /api/loans`
  - `POST /api/loans`
  - `POST /api/loans/:id/return`
- Dashboard/activity:
  - `GET /api/dashboard`
  - `GET /api/activity`
- Settings/options:
  - `GET /api/settings`
  - `PUT /api/settings`
  - `GET /api/options`
- Export:
  - `GET /api/export/books.csv`
  - `GET /api/export/loans.csv`

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

## Deployment

Step-by-step: [docs/deployment.md](./docs/deployment.md)

Short version:

```bash
npm run build
npm run db:migrate:remote
wrangler deploy
```

## Privacy Boundary

Public pages expose only safe fields (title/subtitle/author/publisher/category/language/date/cover/public notes/location).

Private fields remain admin-only:

- purchase price
- personal notes
- loan history
- private acquisition/gift notes
- internal metadata details

## Backup Guidance

- Export books CSV: `/api/export/books.csv`
- Export loans CSV: `/api/export/loans.csv`
- Periodic D1 backup via `wrangler d1 export`
- Keep migrations in Git

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

- OCR integration is provider-ready; quality depends on provider/API key.
- Cover crop is manual-assisted (upgrade-ready for AI auto-crop).
- CSV import intentionally left for next phase; architecture is import-ready.

## Future Roadmap

See [docs/future-improvements.md](./docs/future-improvements.md).
