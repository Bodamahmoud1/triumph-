# Triumph Laundry Guide

Static guide and admin-backed schedule management app for the Triumph Luxury Hotel laundry team.

## Project layout

- `index.html`, `css/`, `js/`, `data/`: public guide UI, PWA service worker, and editable catalogue data.
- `admin/`: browser admin panel for staff, content, data files, schedules, and audit logs.
- `server/`: Express API backed by SQLite and JWT authentication.
- `api/index.js`: Vercel compatibility entry point for preview/static deployments; do not rely on it for durable production SQLite writes.

## Local development

```bash
npm install
cp server/.env.example server/.env
npm run start
```

The app runs on `http://localhost:3000` by default. Local development uses `./triumph_laundry.db` unless `DB_PATH` is set.

## Production persistence

Production must use storage that survives process restarts, redeployments, and serverless instance recycling. Supported options are:

1. **SQLite on a persistent platform volume** (current backend): set `DB_PATH` to an absolute path on the mounted volume, such as `/app/data/triumph.db` on Railway/Render/Fly.io with persistent disk enabled.
2. **Managed database service** (future/adapter-based): use only after adding and configuring a database adapter for that service. The current server uses `better-sqlite3` and does not consume `DATABASE_URL` by itself.

Do **not** set production `DB_PATH` to `/tmp` or any other ephemeral filesystem. Startup fails in production if `DB_PATH` is missing or points under `/tmp`.

### Vercel support

Vercel is supported for the static frontend only. The repository keeps `api/index.js` as a compatibility entry point for previews, but Vercel serverless functions do not provide durable local SQLite storage. Do not deploy the admin API on Vercel for production writes unless you first add a managed database adapter and update the API to use it.

## Checks

```bash
npm run lint
npm run format
npm test
```

These checks validate JavaScript syntax, JSON manifests, service-worker cached assets, CSP hardening, CORS configuration, refresh-token hashing, database path selection, and that runtime SQLite/upload files are not tracked by Git.

## Runtime files

Do not commit generated SQLite databases or uploaded schedule files. The repository ignores `*.db` and `uploads/`; production deployments must persist SQLite via a platform volume or move to a managed database adapter.
