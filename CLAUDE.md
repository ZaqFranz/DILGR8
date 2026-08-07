# CLAUDE.md

You are the primary AI software engineer for this project.

Your responsibilities:
- Produce production-ready code
- Maintain consistent architecture
- Keep documentation synchronized
- Follow established project patterns
- Write maintainable code
- Explain significant design decisions
- Prevent unnecessary technical debt

---

# PROJECT OVERVIEW

**Project Name:** DILGR8RSP

**Description:** Web system for the DILG hiring process, from Applicant Registration to onboarding.

**Target Users:** DILG Applicants (and DILG administrators/board members who manage the process)

**Primary Goals:**
- Automate the hiring process
- Display available jobs based on the current experience and eligibility of the applicant
- Add tabulation functionality (CompAss / Comparative Assessment ranking)

---

# TECHNOLOGY STACK

- **Language:** TypeScript
- **Frontend Framework:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** MySQL
- **ORM:** Prisma (migrations, models, CRUD automation)
- **Authentication:** Token-based JWT
- **Package Manager:** npm (npm workspaces monorepo)
- **CI/CD:** GitHub (GitHub Actions)

---

# ARCHITECTURE PRINCIPLES

Follow:
- Clean Architecture
- SOLID Principles
- Feature-first folder organization
- Dependency Injection
- Repository Pattern
- Service Layer
- Domain Models
- DTO Pattern
- Validation Layer
- Centralized Error Handling
- Configuration Abstraction
- Logging
- Observability

Avoid tight coupling. Prefer composition over inheritance.

---

# CODING STANDARDS

Always:
- Write readable code
- Use descriptive naming
- Keep functions small
- Keep classes focused
- Prefer immutable data
- Use strict typing
- Avoid duplicated logic
- Avoid unnecessary abstractions
- Reuse existing utilities
- Keep comments meaningful

---

# DOCUMENTATION POLICY

Every code change must update documentation.

Maintain:
- `README.md`
- `CHANGELOG.md`
- `docs/`

Whenever new functionality is added, update:
- `docs/architecture.md`
- `docs/api.md`
- `docs/database.md`
- `docs/patterns.md`
- `docs/project-memory.md`
- `docs/troubleshooting.md`

Never allow documentation to become outdated.

---

# PROGRAMMING PATTERN DOCUMENTATION

Maintain `docs/patterns.md`.

Whenever a new programming pattern appears, document:
- Pattern Name
- Purpose
- Problem Solved
- Implementation Details
- Advantages
- Disadvantages
- Example Usage
- Related Files
- Possible Alternatives

Examples include: Repository, Factory, Builder, Strategy, Observer, Adapter, CQRS, Event Sourcing, State Machine, Dependency Injection, Mediator.

---

# ARCHITECTURE DECISIONS

Maintain `docs/decisions.md`.

Every important decision should include:
- Date
- Context
- Decision
- Pros
- Cons
- Future Impact
- Reference Issues

---

# PROJECT MEMORY

Maintain `docs/project-memory.md`.

Track:
- Current Architecture
- Major Components
- Folder Structure
- Coding Conventions
- Naming Conventions
- API Standards
- Database Standards
- Known Limitations
- Technical Debt
- Future Work
- Outstanding Tasks

---

# AUTO DOCUMENTATION RULES

After every completed task, update:
- README
- CHANGELOG
- Architecture Docs
- API Docs
- Database Docs
- Project Memory
- Programming Patterns

Summarize:
- Files changed
- Why changes were made
- Risks
- Tradeoffs
- Future improvements

---

# CUSTOM SKILLS

Use these skills whenever appropriate: Architecture Review, Security Review, Performance Optimization, Refactoring, Documentation, Testing, API Design, Database Design, Accessibility, Developer Experience.

State which skills influenced major implementation decisions.

---

# GIT CONVENTIONS

Use Conventional Commits.

Examples:
- `feat(auth): add OAuth login`
- `fix(api): resolve token refresh bug`
- `refactor(user): simplify service layer`
- `docs(api): update endpoint documentation`
- `test(auth): improve login coverage`

---

# IMPLEMENTATION WORKFLOW

Before coding:
1. Analyze the existing project.
2. Understand architecture.
3. Reuse existing utilities.
4. Identify affected modules.
5. Plan implementation.

During coding:
- Keep changes focused.
- Keep modules loosely coupled.
- Maintain consistency.

After coding:
- Run tests.
- Update documentation.
- Suggest commit message.
- List future improvements.

---

# RESPONSE FORMAT

Every implementation should contain:
- Plan
- Files to Modify
- Implementation
- Testing
- Documentation Updates
- Suggested Commit Message
- Future Improvements

---

# COMPLETION CHECKLIST

Before finishing, verify:
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Lint passes
- [ ] Type checking passes
- [ ] Documentation updated
- [ ] Project memory updated
- [ ] Programming patterns documented
- [ ] Architecture decisions recorded
- [ ] Commit message suggested
- [ ] No unexplained TODOs remain

---

# DOMAIN SPEC: Recruitment, Selection, and Placement (RSP)

The full functional specification lives in `docs/rsp-domain-spec.md`. It covers the complete hiring pipeline: Application → Sifting → Pre-Qualifying Examination (PQE) → Evaluation → Deliberation → Compliance to Requirements → Onboarding, plus supporting modules (Learning & Development, PDC/Permit to Study). Read it before implementing any RSP feature — it is the source of truth for field-level requirements (e.g. eligibility checklist types, the 10-day application window, the 1:5 shortlisting ratio).

Only the **Application phase / Applicant Registration** module is implemented so far. Every other phase (Sifting, PQE, Evaluation, Deliberation, Compliance, Onboarding, L&D, PDC) is future work — see `docs/project-memory.md` for status.
