# Triumph Laundry Guide

Static guide and admin-backed schedule management app for the Triumph Luxury Hotel laundry team.

## Architecture

- **Frontend/PWA:** `index.html`, `css/`, `js/`, `data/`, `sw.js`, and generated `sw-app-shell.js` are served as static files.
- **Admin UI:** `admin/` is a static browser admin panel that calls the backend API.
- **Backend API:** `server/` is an Express app backed by SQLite, versioned migrations, JWT access tokens, and rotating refresh-token sessions.
- **Database:** SQLite is supported only on a persistent filesystem volume in production. Runtime DB files, backups, uploads, and office documents are intentionally ignored and must not be committed.

## Deployment decision

Use **Vercel for static frontend/admin assets only** and deploy `server/` as a separate Node service on Render or Railway with a persistent volume mounted at `DB_PATH`.

The repository intentionally does **not** rewrite `/api/*` to Vercel serverless functions because local SQLite in `/tmp` is ephemeral and unsafe for production data.

## Local development

```bash
npm install
cp _env.example server/.env
npm run migrate
npm run start
```

The app runs on `http://localhost:3000` by default.

## Checks

```bash
npm ci
npm test
npm run lint
npm run format
```

These checks validate JavaScript, JSON manifests, service-worker cached assets, CSP hardening, CORS configuration, refresh-token hashing/rotation, migrations, upload security, content validation, and that runtime/binary production files are not tracked by Git.

## Environment variables

| Variable         | Required      | Notes                                                                                                                        |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`       | Production    | Set to `production` on the API host.                                                                                         |
| `PORT`           | API host      | Provided by Render/Railway.                                                                                                  |
| `DB_PATH`        | Production    | Absolute path on a persistent volume, e.g. `/opt/render/project/src/server/db/triumph_laundry.db` or `/app/data/triumph.db`. |
| `JWT_SECRET`     | Production    | Secure random string.                                                                                                        |
| `ADMIN_USERNAME` | Initial setup | Username seeded when no admins exist.                                                                                        |
| `ADMIN_PASSWORD` | Initial setup | Strong initial password; change after first login.                                                                           |
| `CORS_ORIGIN`    | Production    | Comma-separated allowed frontend/admin origins. No production default is allowed.                                            |

## Admin setup

1. Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `DB_PATH`, and `CORS_ORIGIN` before first production start.
2. Run `npm run migrate` from the repository root or `npm run migrate` inside `server/`.
3. Start the API service.
4. Sign in at `/admin` and change the seeded password.

## Backups and restore

- The server writes scheduled SQLite backups under `server/db/backups/`; keep that directory on persistent storage and outside Git.
- To restore, stop the API process, copy the selected backup to `DB_PATH`, run `npm run migrate`, then restart the service.
- Uploaded schedule preview files are transient and should not be backed up as application state.

## Runtime files and repository hygiene

Do not commit generated SQLite databases, DB WAL/SHM files, backup databases, uploaded schedule files, exported Excel/PDF/PPTX documents, or local handoff files. The `.gitignore` blocks these, and CI fails if runtime/binary production documents are tracked.

If sensitive files have already been pushed to a shared remote, remove them from Git history with a tool such as `git filter-repo` or BFG, rotate any exposed secrets, and force-push only after coordinating with collaborators.

## Arabic presentation

Generate the 12-slide Arabic product presentation without installing additional dependencies:

```bash
python3 tools/generate_arabic_presentation.py
```

The generated PowerPoint file is written to `deliverables/triumph-laundry-ar.pptx`. Exported office documents remain ignored by Git; regenerate the deck from the tracked source when needed.
