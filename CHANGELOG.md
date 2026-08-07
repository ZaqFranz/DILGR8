# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Initial project scaffold: npm workspaces monorepo (`backend`, `frontend`).
- `CLAUDE.md` governance/workflow rules and `docs/` structure (architecture, api, database, patterns, decisions, project-memory, troubleshooting, rsp-domain-spec).
- Backend: Express + TypeScript API with feature-first Clean Architecture (`modules/{auth,applicants,job-postings,applications}`), Prisma ORM against MySQL, JWT authentication, centralized error handling, request validation (Zod), Pino logging.
- Frontend: React + TypeScript (Vite) SPA with feature-first structure, JWT-aware API client.
- Applicant Registration feature (Application phase of the RSP pipeline): account registration/login, demographic profile, work experience, learning & development interventions, eligibility checklist with proof upload, awards, IPCR/Designation-to-Higher-Position upload for promotional applications, job posting listing, and application submission.
- Local MySQL database provisioned (via XAMPP's bundled MariaDB) and initial Prisma migration applied, creating all tables per `docs/database.md`. Seed data adds one admin user and two sample job postings.
