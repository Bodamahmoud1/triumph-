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

## Deployment

### Frontend (Vercel)
The root of this repository should be deployed to Vercel as a static site. No build command is necessary.

### Backend (Railway or Render)
Deploy the `server` directory as a Node.js web service.

**Required Environment Variables in Production:**
- `PORT` (Provided by Railway/Render)
- `JWT_SECRET` (Generate a secure random string)
- `ADMIN_USERNAME` (For initial seeding)
- `ADMIN_PASSWORD` (For initial seeding)
- `CORS_ORIGIN` (Set to `https://triumph-laundry.vercel.app`)

**Important Notes for SQLite:**
Since this uses SQLite, the database file must persist across deployments. If deploying on Railway, attach a Persistent Volume to the `/app/data` path and set `DB_PATH=/app/data/triumph.db`.
