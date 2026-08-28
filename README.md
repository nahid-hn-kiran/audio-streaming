# Audio Streaming Platform

Audio Streaming Platform is a small full-stack music application. It provides a published catalog, private audio playback, listener libraries, and an admin workflow for taking catalog metadata from draft to playable content.

## Overview

Listeners can browse artists, albums, and tracks, play published audio, like tracks, create playlists, and review listening history. Administrators create and publish catalog records, upload audio directly to private Cloudflare R2 storage, and publish a track only after the backend has verified its media.

Authentication and authorization are handled by the API. The client uses the resulting session for navigation and user experience, but the server remains responsible for roles, ownership, and publication rules.

## Features

- Better Auth email/password registration, login, logout, sessions, and secure cookies
- `USER` and `ADMIN` roles with server-side admin authorization
- Public artist, album, and track catalog with draft/published/archived filtering
- Private signed playback URLs and one global browser audio player
- Admin catalog management for artists, albums, and tracks
- Direct browser-to-R2 audio uploads using presigned URLs
- Upload completion verification with `HeadObject` before media becomes ready
- Explicit track publication workflow
- User playlists with visibility, track ordering, and ownership checks
- Track likes and liked-track listing
- Listening history with playback source and completion fields
- Manual cleanup command for expired or failed uploads
- Idempotent development user and demo catalog seeds

## Application workflow

Administrators follow this sequence:

```text
Create artist → publish artist → create album → publish album
→ create track → upload audio → verify media → publish track
```

Audio is uploaded directly from the browser to private R2 storage. The API creates the upload session and presigned URL, then verifies the object’s size and content type before associating a ready `MediaAsset`. Upload completion does not publish the track.

Listeners browse the published catalog, open an artist, album, or track, and play audio through the shared player. They can like tracks, add published tracks to playlists, reorder their own playlists, and view listening history.

## Tech stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS (`client/`)
- Express 5 and TypeScript (`server/`)
- PostgreSQL with Prisma 7
- Better Auth with the Prisma adapter
- Zod for request and environment validation
- Cloudflare R2 through the AWS SDK S3-compatible client
- Node’s built-in test runner with `tsx`

## Project structure

```text
client/
  app/             Next.js routes and page layouts
  components/      Shared shell, catalog, player, auth, and library UI
  lib/             API and feature helpers

server/
  src/routes/      Express route modules
  src/services/    Catalog, auth-related, playlist, media, and library logic
  src/validation/  Zod schemas at API boundaries
  src/storage/     Object-storage abstraction and R2 implementation
  src/prisma/      Generated Prisma client
  prisma/          Schema, migrations, and seed scripts
  test/            Integration tests
```

## Getting started

### Prerequisites

- Node.js 20.19 or newer
- npm
- PostgreSQL
- A private Cloudflare R2 bucket for real upload and playback testing

Install dependencies in both applications:

```bash
cd server
npm install

cd ../client
npm install
```

### Environment

Copy the templates and fill in local values. Never commit populated environment files.

Server variables include `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_ORIGIN`, and the private R2 settings: `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, and `OBJECT_STORAGE_SECRET_ACCESS_KEY`. Upload and playback limits are configurable with `MAX_AUDIO_UPLOAD_BYTES`, `UPLOAD_URL_TTL_SECONDS`, and `PLAYBACK_URL_TTL_SECONDS`.

The client uses `NEXT_PUBLIC_API_URL` and optionally `NEXT_PUBLIC_MAX_AUDIO_UPLOAD_BYTES`.

### Database and development servers

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

In a second terminal:

```bash
cd client
npm run dev
```

The default development URLs are `http://localhost:4000` for the API and `http://localhost:3000` for the client. `GET /health` is the server health probe.

## Demo data

Seed the development accounts with passwords supplied through environment variables:

```bash
cd server
npm run seed:users
```

The demo catalog seed creates four fictional artists, six albums, and twelve tracks. It generates short WAV files locally and sends each one through the real presigned R2 upload, completion verification, media readiness, and publication flow:

```bash
npm run seed:demo
```

The seed uses stable slugs and is safe to run repeatedly. Generated files are written to `server/demo-audio/` and are ignored by Git; the seed recreates them as needed. R2 configuration must be present before running it.

## Admin workflow

The admin workspace is available under `/admin` and includes artist, album, and track management. Track audio is uploaded from `/admin/tracks/[id]/upload`. The API enforces publication dependencies, primary artist credits, media readiness, and admin authorization.

## Storage

Audio objects are kept in a private Cloudflare R2 bucket. The browser never receives storage credentials, bucket credentials, or object keys. Uploads use short-lived presigned PUT URLs; playback uses short-lived signed download URLs generated by the API.

## API

The API is served by Express under `/api`.

- Better Auth routes: `/api/auth/*`; current user: `/api/me`
- Public catalog: `/api/v1/artists`, `/api/v1/artists/:slug`, `/api/v1/albums/:slug`, `/api/v1/tracks/:id`
- Playback: `/api/v1/tracks/:id/playback`
- Admin catalog and media upload routes under `/api/v1/admin`
- Playlists under `/api/v1/playlists`
- Likes and history under `/api/v1/tracks/*/like`, `/api/v1/me/liked-tracks`, `/api/v1/tracks/*/history`, and `/api/v1/me/history`

All protected operations derive identity from the authenticated session. Request bodies and route parameters are validated with Zod.

## Development commands

Client:

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

Server:

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run cleanup:uploads
```

## Current limitations

- Artwork is represented by deterministic frontend fallbacks; the backend does not yet provide an artwork upload workflow.
- There is no admin listing endpoint for unpublished catalog records, so admin lists use data available through the public catalog APIs. Newly created resources continue through their direct success actions.
- Playback history records play-start events; there is no progress-update endpoint.
- The MVP uses a single S3-compatible storage provider and a manual upload-cleanup command rather than a background worker.
