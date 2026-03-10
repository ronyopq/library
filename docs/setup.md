# Setup Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account
- Wrangler CLI (installed via project dependencies)

## 1) Install dependencies

```bash
npm install
```

## 2) Create Cloudflare resources

### D1 Database

```bash
wrangler d1 create library-db
```

Copy the `database_id` into `wrangler.toml` under `[[d1_databases]]`.

### KV Namespace

```bash
wrangler kv namespace create LIBRARY_KV
wrangler kv namespace create LIBRARY_KV --preview
```

Copy the IDs into `wrangler.toml` under `[[kv_namespaces]]`.

## 3) Configure local environment

Copy and update values:

```bash
cp .env.example .env
```

Optional values:

- `ADMIN_TOKEN`: protect admin API routes
- `OCR_SPACE_API_KEY`: enable OCR extraction provider
- `PUBLIC_BASE_URL`: default public URL base for QR/links

## 4) Apply local D1 migrations + seed

```bash
npm run db:migrate:local
npm run db:seed:local
```

## 5) Run local development

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Worker API: [http://localhost:8787](http://localhost:8787)

Vite proxies `/api`, `/b`, and `/i` to the Worker in development.

Public/Admin routes:

- Public catalog: `http://localhost:5173/`
- Admin login: `http://localhost:5173/admin/login`
- Admin panel: `http://localhost:5173/admin/dashboard`

## 6) Validate build and types

```bash
npm run typecheck
npm run build
```

## Notes

- Draft autosave is browser-local by design for low-friction mobile UX.
- Cover files are stored in KV; suitable for personal library scale MVP.
- If `ADMIN_TOKEN` is set, include `x-admin-token` in admin requests (UI stores token from `/admin/login`).
