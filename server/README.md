# Triumph Laundry Backend

Express API for Triumph Laundry schedule and management features.

## Technologies Used

- Express.js
- SQLite via `better-sqlite3`
- Versioned SQL migrations in `server/db/migrations/`
- `exceljs` for XLSX parsing
- JWT access tokens plus hashed, rotating refresh-token sessions

## Setup for Local Development

```bash
npm install
cp ../_env.example .env
npm run migrate
npm run dev
```

The server runs on `http://localhost:3000`.

## Required Production Environment

- `NODE_ENV=production`
- `PORT` from the host
- `DB_PATH` as an absolute path on persistent storage
- `JWT_SECRET` as a secure random string
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` for first boot seeding
- `CORS_ORIGIN` as a comma-separated allowlist, for example `https://triumph-laundry.vercel.app`

## Backend (Render/Railway only)

Deploy the `server` directory, or the repo root with `server/index.js` as the start command, to Render/Railway with a persistent volume. Do not run the API on Vercel serverless while using SQLite; `/tmp` is ephemeral and will lose production data.

Example persistent SQLite paths:

- Render: `/opt/render/project/src/server/db/triumph_laundry.db`
- Railway volume: `/app/data/triumph.db`

## Migrations

Migrations are fixed, versioned SQL files under `server/db/migrations/`. Do not edit migrations that have already run in production; create the next numbered file instead.

```bash
npm run migrate
```

The migration runner stores SHA-256 checksums and fails if an applied migration file changes.

## Security notes

- `JWT_SECRET` is mandatory in production.
- `CORS_ORIGIN` is mandatory in production and has no broad fallback.
- Refresh tokens are returned once, stored as SHA-256 hashes, rotated on refresh, tracked with IP/user-agent/last-used metadata, and also issued as HttpOnly SameSite cookies for same-site deployments.
- Runtime uploads, SQLite databases, generated backups, and exported office documents must stay out of Git.
