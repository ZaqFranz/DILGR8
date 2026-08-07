# DILGR8RSP

Web system for the DILG hiring process — Recruitment, Selection, and Placement (RSP) — from Applicant Registration through Onboarding.

## Status

This is an early-stage build. Only the **Application phase (Applicant Registration)** is implemented. See [docs/project-memory.md](./docs/project-memory.md) for what's built vs. outstanding, and [docs/rsp-domain-spec.md](./docs/rsp-domain-spec.md) for the full target functional spec.

## Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | MySQL |
| ORM | Prisma |
| Auth | JWT (access token) |
| Package manager | npm workspaces |

## Project Structure

```
DILG_hiring/
├── backend/           # Express + TypeScript API
│   ├── prisma/         # Prisma schema & migrations
│   └── src/
│       ├── config/      # env/config loading
│       ├── modules/     # feature-first: auth, applicants, job-postings, applications
│       └── shared/      # cross-cutting: errors, middleware, logging, validation
├── frontend/          # React + TypeScript SPA
│   └── src/
│       ├── features/    # feature-first: auth, applicant-registration, job-postings
│       └── shared/      # api client, layout, UI primitives
└── docs/              # architecture, api, database, patterns, decisions, project-memory
```

## Getting Started

### Prerequisites
- Node.js 20+
- A running MySQL-compatible server (MySQL 8+ or MariaDB 10.4+). Any local install works, including XAMPP's bundled MariaDB (`C:\xampp\mysql_start.bat` to start it; default `root` user has no password).

### 1. Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev
npx prisma db seed     # optional: creates an admin user + 2 sample job postings
npm run dev
```

Backend runs on `http://localhost:4000` by default.

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # fill in VITE_API_URL
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` by default.

## Documentation

- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Database Schema](./docs/database.md)
- [Programming Patterns](./docs/patterns.md)
- [Architecture Decisions](./docs/decisions.md)
- [Project Memory](./docs/project-memory.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [RSP Domain Spec](./docs/rsp-domain-spec.md)

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`, `test(...)`).
