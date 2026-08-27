# Audio Streaming Platform

A portfolio-quality audio streaming platform with a public music catalog, browser playback, listener libraries, and an admin-managed content workflow. The project is intentionally beginning with a small, separated frontend/API foundation.

## Architecture

- `client/` — Next.js, TypeScript, Tailwind CSS, and the future shadcn/ui component layer.
- `server/` — Express REST API, TypeScript, Zod configuration validation, and Prisma.
- PostgreSQL — primary relational database, configured through `DATABASE_URL`.
- Object storage — planned for audio and artwork; it is not configured in this foundation.

The frontend and API remain independent applications. The API will own authentication, authorization, validation, data access, and future storage access. No workspace or shared package system is used yet.

## Prerequisites

- Node.js 20.19+ (Node 22 LTS recommended for current Prisma 7 tooling)
- npm 10+
- A PostgreSQL database when database work begins

## Setup

```bash
cd client
npm install
npm run dev
```

In another terminal:

```bash
cd server
copy .env.example .env
# Set DATABASE_URL to your PostgreSQL connection string.
npm install
npm run dev
```

The web app runs on `http://localhost:3000`; the API defaults to `http://localhost:4000`. The API health probe is available at `GET /health`.

## Commands

| Application | Command | Purpose |
| --- | --- | --- |
| client | `npm run dev` | Start Next.js development server |
| client | `npm run build` | Production build |
| client | `npm run typecheck` | Type-check source files |
| client | `npm run lint` | Run ESLint |
| server | `npm run dev` | Start Express with file watching |
| server | `npm run build` | Compile TypeScript to `dist/` |
| server | `npm run typecheck` | Type-check source files |
| server | `npm run lint` | Run ESLint |
| server | `npm run prisma:generate` | Generate Prisma Client |
| server | `npm run prisma:migrate` | Create and apply a development migration |

## Current status

Foundation complete: separate application manifests, TypeScript configuration, Next.js/Tailwind baseline, Express API baseline, PostgreSQL/Prisma configuration, environment templates, and project guidance are present.

Not implemented: database entities/migrations, authentication, authorization, catalog management, uploads/storage, playback, playlists, likes, history, search, or shadcn/ui components.

## Authentication integration note

Better Auth will be hosted by the Express API, not the Next.js application. Current official guidance requires ESM and mounting Better Auth's Express handler before `express.json()`; Express 5 uses the named catch-all pattern `/{*any}`. Authentication is deliberately deferred until the application data model is defined.

