# Troubleshooting

## `npm install` warns about pending install scripts / `allow-scripts`

This repo's npm install-scripts policy (`allowScripts` in the root `package.json`) blocks postinstall scripts by default (a supply-chain safety measure). `@prisma/client`, `@prisma/engines`, `prisma`, and `esbuild` need theirs to run (Prisma client generation, esbuild native binary). If you see:

```
npm warn allow-scripts 5 packages have install scripts not yet covered by allowScripts:
```

Run:

```bash
npm approve-scripts "@prisma/client" "@prisma/engines" esbuild prisma
npm rebuild
```

Then generate the Prisma client explicitly (the postinstall hook doesn't always trigger reliably across workspace boundaries):

```bash
cd backend && npx prisma generate
```

## Backend fails to start with an env validation error

`backend/src/config/env.ts` validates `process.env` with Zod at startup and throws immediately if anything's missing/malformed (fail-fast, not silent defaults for required values). Copy `backend/.env.example` to `backend/.env` and fill in a real `DATABASE_URL` and a `JWT_SECRET` of at least 16 characters.

## `EADDRINUSE: address already in use :::4000`

Another instance of the server (or something else) is already bound to the port. Find and stop it:

```bash
netstat -ano | findstr :4000
# note the PID in the last column, then:
taskkill /F /PID <pid>
```

Or change `PORT` in `backend/.env`.

## API returns `{"error":{"code":"INTERNAL_ERROR","message":"Something went wrong"}}` on every request

Almost always means Prisma can't reach MySQL — `DATABASE_URL` points at a database that doesn't exist or isn't running. Check the backend logs (Pino prints the underlying error at `error` level even though the client only sees the generic message — this is intentional, see [patterns.md § Centralized Error Handling](./patterns.md#centralized-error-handling)). Start MySQL, create the database, then run `npx prisma migrate dev` from `backend/`.

## File upload fails with `VALIDATION_ERROR: Only PDF, JPEG, or PNG files are allowed` or a Multer error

`backend/src/modules/applicants/documents/documents.upload.ts` allow-lists `application/pdf`, `image/jpeg`, `image/png` and caps size at `MAX_UPLOAD_SIZE_BYTES` (default 5MB, configurable in `.env`). Errors from Multer (including "file too large") are caught by the shared `errorHandler` and returned as `UPLOAD_ERROR`.

## Frontend can't reach the API / CORS errors in the browser console

Check `frontend/.env`'s `VITE_API_URL` matches where the backend is actually listening, and `backend/.env`'s `CORS_ORIGIN` includes the frontend's origin (comma-separated list if more than one). Restart both dev servers after changing env files — Vite and `tsx watch` don't hot-reload `.env` changes.

## `tsc-alias` / `@/*` imports not resolving after `npm run build` (backend)

The backend build is two steps: `tsc` (compiles TS→JS, leaves `@/foo` imports as-is) then `tsc-alias` (rewrites those into relative `require()` paths). If you add a new path-alias pattern to `tsconfig.json`'s `paths`, make sure both `backend/package.json`'s `build` script steps still run (`tsc -p tsconfig.json && tsc-alias -p tsconfig.json`) — running `tsc` alone will produce a `dist/` that crashes at runtime with `Cannot find module '@/...'`.
