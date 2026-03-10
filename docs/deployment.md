# Deployment Guide (Cloudflare)

## 1) Build frontend assets

```bash
npm run build
```

This outputs static files to `dist/`, which are served by Worker assets binding.

## 2) Apply remote D1 migrations

```bash
npm run db:migrate:remote
```

Optional initial seed:

```bash
wrangler d1 execute library-db --remote --file drizzle/0001_seed.sql
```

## 3) Deploy Worker + assets

```bash
wrangler deploy
```

## 4) Verify key routes

- `GET /` admin SPA
- `GET /api/health` health check
- `GET /api/dashboard` dashboard payload
- `GET /b/<publicCode>` public page (for public books)

## 5) Environment and secrets

Set optional secrets for production:

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put OCR_SPACE_API_KEY
wrangler secret put PUBLIC_BASE_URL
```

## 6) Suggested post-deploy checks

- Add a manual book and verify dashboard updates
- Test ISBN lookup and confirm cached repeat lookup latency drops
- Upload/crop a cover and verify `/i/:key`
- Create and return a loan
- Print labels and verify layout
- Open public route `/b/:shortId` and verify private fields remain hidden

## Rollback strategy

- Keep migrations incremental; avoid editing old migration files.
- Deploy previous git tag/commit if application regression occurs.
- For schema rollback, create explicit forward-fix migration instead of destructive rollback in production.