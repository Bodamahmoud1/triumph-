# Triumph Laundry Backend

This is the backend for the Triumph Laundry schedule and management app.

## Technologies Used
- Express.js
- SQLite (via `better-sqlite3`)
- `exceljs` for XLSX parsing
- JWT for authentication

## Setup for Local Development

1. Run `npm install`
2. Create a `.env` file from the `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. The server runs on `http://localhost:3000`.

Local development uses `./triumph_laundry.db` by default. Set `DB_PATH` if you want to keep the development database somewhere else.

## Security notes

- Refresh tokens are returned to the admin client once and stored as SHA-256 hashes in SQLite.
- `JWT_SECRET` is mandatory in production.
- Production `DB_PATH` is mandatory and must point to persistent storage; startup rejects `/tmp` paths in production.
- Runtime uploads and SQLite database files must be kept on persistent storage and out of Git.

## Deployment

### Frontend (Vercel)
The root of this repository can be deployed to Vercel as a static site. No build command is necessary.

Vercel is **not** supported as the production admin API host for durable SQLite writes. Its serverless filesystem is ephemeral, so the compatibility `api/index.js` entry point is appropriate only for previews/static/API experiments that do not require persistent local SQLite state. To run production writes on Vercel, first add a managed database adapter and update the server to use that adapter instead of `better-sqlite3` file storage.

### Backend (Railway, Render, Fly.io, or another Node host with persistent disk)
Deploy the `server` directory as a Node.js web service and attach a persistent volume for SQLite.

**Required Environment Variables in Production:**
- `PORT` (provided by the host)
- `JWT_SECRET` (generate a secure random string)
- `ADMIN_USERNAME` (for initial seeding)
- `ADMIN_PASSWORD` (for initial seeding)
- `CORS_ORIGIN` (set to `https://triumph-laundry.vercel.app`; comma-separated origins are supported)
- `DB_PATH` (absolute path to the SQLite file on persistent storage, for example `/app/data/triumph.db`)

**Supported production persistence options:**

1. **SQLite with a persistent volume**: attach a platform volume, ensure the Node process can write to it, and set `DB_PATH` to a file inside that mount. For example, on Railway attach a volume mounted at `/app/data` and set `DB_PATH=/app/data/triumph.db`.
2. **Managed database**: add an adapter for the target database before enabling this option. The current backend is SQLite-only and does not read `DATABASE_URL` without additional adapter code.

**Important Notes for SQLite:**
The SQLite database file must persist across deployments. Never use `/tmp/triumph_laundry.db` or another temporary path for production `DB_PATH`; the server exits during startup if production `DB_PATH` is missing or points under `/tmp`.
