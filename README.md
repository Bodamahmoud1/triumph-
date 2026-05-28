# Triumph Laundry Guide

Static guide and admin-backed schedule management app for the Triumph Luxury Hotel laundry team.

## Project layout

- `index.html`, `css/`, `js/`, `data/`: public guide UI, PWA service worker, and editable catalogue data.
- `admin/`: browser admin panel for staff, content, data files, schedules, and audit logs.
- `server/`: Express API backed by SQLite and JWT authentication.
- `api/index.js`: Vercel compatibility entry point that exports the Express app.

## Local development

```bash
npm install
cp server/.env.example server/.env
npm run start
```

The app runs on `http://localhost:3000` by default.

## Checks

```bash
npm run lint
npm run format
npm test
```

These checks validate JavaScript syntax, JSON manifests, service-worker cached assets, CSP hardening, CORS configuration, refresh-token hashing, and that runtime SQLite/upload files are not tracked by Git.

## Runtime files

Do not commit generated SQLite databases or uploaded schedule files. The repository ignores `*.db` and `uploads/`; production deployments should persist SQLite via a platform volume or move to a managed database.
