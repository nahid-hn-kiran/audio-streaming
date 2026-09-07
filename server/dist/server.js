// src/app.ts
import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";

// src/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

// src/config/env.ts
import "dotenv/config";
import { z } from "zod";
var environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(4e3),
  CLIENT_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
  OBJECT_STORAGE_PROVIDER: z.enum(["r2"]).default("r2"),
  OBJECT_STORAGE_ENDPOINT: z.url().optional(),
  OBJECT_STORAGE_REGION: z.string().default("auto"),
  OBJECT_STORAGE_BUCKET: z.string().default("audio-streaming"),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  MAX_AUDIO_UPLOAD_BYTES: z.coerce.number().int().positive().default(104857600),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
  PLAYBACK_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  UPLOAD_CLEANUP_GRACE_SECONDS: z.coerce.number().int().positive().default(86400)
}).superRefine((values, context) => {
  if (values.NODE_ENV !== "production") return;
  for (const field of ["CLIENT_ORIGIN", "BETTER_AUTH_URL"]) {
    if (new URL(values[field]).protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${field} must use HTTPS in production`
      });
    }
  }
  for (const field of ["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY"]) {
    if (!values[field]) context.addIssue({ code: "custom", path: [field], message: `${field} is required in production` });
  }
});
var env = environmentSchema.parse(process.env);

// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";

// src/generated/prisma/client.ts
import * as path from "path";
import { fileURLToPath } from "url";

// src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.10.0",
  "engineVersion": "0edf323efd1d98336f3f0a68684b56f689b900d3",
  "activeProvider": "postgresql",
  "inlineSchema": `generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  USER
  ADMIN
}

enum PublicationStatus {
  DRAFT
  PROCESSING
  PUBLISHED
  ARCHIVED
}

enum MediaKind {
  AUDIO
  IMAGE
}

enum MediaStatus {
  PENDING
  READY
  FAILED
  DELETED
}

enum UploadStatus {
  INITIATED
  UPLOADING
  UPLOADED
  COMPLETED
  FAILED
  EXPIRED
}

enum PlaylistVisibility {
  PRIVATE
  PUBLIC
  UNLISTED
}

enum TrackCreditType {
  PRIMARY
  FEATURED
}

enum ListeningHistorySource {
  TRACK_PAGE
  ALBUM
  PLAYLIST
  SEARCH
  QUEUE
}

// Better Auth core schema. Keep these field names and table mappings aligned
// with Better Auth's Prisma adapter configuration.
model User {
  id            String             @id
  name          String
  email         String             @unique
  emailVerified Boolean            @default(false)
  image         String?
  role          Role               @default(USER)
  createdAt     DateTime           @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime           @updatedAt @db.Timestamptz(3)
  sessions      Session[]
  accounts      Account[]
  playlists     Playlist[]
  trackLikes    TrackLike[]
  history       ListeningHistory[]
  uploads       Upload[]

  @@index([role])
  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime @db.Timestamptz(3)
  token     String   @unique
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  issuer                String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime? @db.Timestamptz(3)
  refreshTokenExpiresAt DateTime? @db.Timestamptz(3)
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime  @updatedAt @db.Timestamptz(3)

  @@unique([issuer, accountId])
  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime @db.Timestamptz(3)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @db.Timestamptz(3)

  @@index([identifier])
  @@index([expiresAt])
  @@map("verification")
}

model Artist {
  id           String            @id @default(uuid()) @db.Uuid
  name         String
  slug         String            @unique
  bio          String?
  imageAssetId String?           @unique @db.Uuid
  status       PublicationStatus @default(DRAFT)
  createdAt    DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime          @updatedAt @db.Timestamptz(3)
  albums       Album[]
  trackCredits TrackArtist[]
  imageAsset   MediaAsset?       @relation("ArtistImage", fields: [imageAssetId], references: [id], onDelete: SetNull)

  @@index([status, name])
  @@index([createdAt])
}

model Album {
  id           String            @id @default(uuid()) @db.Uuid
  artistId     String            @db.Uuid
  title        String
  slug         String            @unique
  description  String?
  coverAssetId String?           @unique @db.Uuid
  releaseDate  DateTime?         @db.Timestamptz(3)
  status       PublicationStatus @default(DRAFT)
  createdAt    DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime          @updatedAt @db.Timestamptz(3)
  artist       Artist            @relation(fields: [artistId], references: [id], onDelete: Restrict)
  tracks       Track[]
  coverAsset   MediaAsset?       @relation("AlbumCover", fields: [coverAssetId], references: [id], onDelete: SetNull)

  @@index([artistId, status])
  @@index([status, releaseDate])
  @@index([status, title])
}

model Track {
  id              String             @id @default(uuid()) @db.Uuid
  albumId         String             @db.Uuid
  title           String
  slug            String             @unique
  trackNumber     Int
  discNumber      Int                @default(1)
  durationSeconds Int?
  status          PublicationStatus  @default(DRAFT)
  mediaAssetId    String?            @unique @db.Uuid
  createdAt       DateTime           @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime           @updatedAt @db.Timestamptz(3)
  album           Album              @relation(fields: [albumId], references: [id], onDelete: Restrict)
  mediaAsset      MediaAsset?        @relation("TrackAudio", fields: [mediaAssetId], references: [id], onDelete: SetNull)
  artists         TrackArtist[]
  playlistTracks  PlaylistTrack[]
  likes           TrackLike[]
  history         ListeningHistory[]
  uploads         Upload[]

  @@unique([albumId, discNumber, trackNumber])
  @@index([albumId, discNumber, trackNumber])
  @@index([status, title])
  @@index([createdAt])
}

model Upload {
  id                String       @id @default(uuid()) @db.Uuid
  trackId           String       @db.Uuid
  initiatedByUserId String
  mediaAssetId      String?      @db.Uuid
  provider          String
  bucket            String
  objectKey         String
  originalFilename  String
  expectedMimeType  String
  expectedByteSize  BigInt
  checksum          String?
  status            UploadStatus @default(INITIATED)
  failureCode       String?
  expiresAt         DateTime     @db.Timestamptz(3)
  completedAt       DateTime?    @db.Timestamptz(3)
  createdAt         DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime     @updatedAt @db.Timestamptz(3)
  track             Track        @relation(fields: [trackId], references: [id], onDelete: Cascade)
  initiatedBy       User         @relation(fields: [initiatedByUserId], references: [id], onDelete: Cascade)
  mediaAsset        MediaAsset?  @relation(fields: [mediaAssetId], references: [id], onDelete: SetNull)

  @@index([trackId, status])
  @@index([status, expiresAt])
}

model TrackArtist {
  trackId    String          @db.Uuid
  artistId   String          @db.Uuid
  creditType TrackCreditType @default(PRIMARY)
  position   Int             @default(0)
  track      Track           @relation(fields: [trackId], references: [id], onDelete: Cascade)
  artist     Artist          @relation(fields: [artistId], references: [id], onDelete: Restrict)

  @@id([trackId, artistId])
  @@unique([trackId, position])
  @@index([artistId, creditType])
}

model MediaAsset {
  id              String      @id @default(uuid()) @db.Uuid
  kind            MediaKind
  storageProvider String
  bucket          String
  objectKey       String
  mimeType        String
  byteSize        BigInt
  checksum        String?
  durationSeconds Int?
  status          MediaStatus @default(PENDING)
  createdAt       DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime    @updatedAt @db.Timestamptz(3)
  audioTrack      Track?      @relation("TrackAudio")
  albumCover      Album?      @relation("AlbumCover")
  artistImage     Artist?     @relation("ArtistImage")
  uploads         Upload[]

  @@unique([bucket, objectKey])
  @@index([kind, status])
  @@index([createdAt])
}

model Playlist {
  id          String             @id @default(uuid()) @db.Uuid
  ownerId     String
  name        String
  description String?
  visibility  PlaylistVisibility @default(PRIVATE)
  createdAt   DateTime           @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime           @updatedAt @db.Timestamptz(3)
  owner       User               @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  tracks      PlaylistTrack[]

  @@unique([ownerId, name])
  @@index([ownerId, updatedAt])
  @@index([visibility, updatedAt])
}

model PlaylistTrack {
  playlistId String   @db.Uuid
  trackId    String   @db.Uuid
  position   Int
  addedAt    DateTime @default(now()) @db.Timestamptz(3)
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  track      Track    @relation(fields: [trackId], references: [id], onDelete: Cascade)

  @@id([playlistId, trackId])
  @@unique([playlistId, position])
  @@index([trackId])
}

model TrackLike {
  userId    String
  trackId   String   @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  track     Track    @relation(fields: [trackId], references: [id], onDelete: Cascade)

  @@id([userId, trackId])
  @@index([userId, createdAt])
  @@index([trackId, createdAt])
}

model ListeningHistory {
  id              String                  @id @default(uuid()) @db.Uuid
  userId          String
  trackId         String                  @db.Uuid
  playedAt        DateTime                @default(now()) @db.Timestamptz(3)
  progressSeconds Int?
  completed       Boolean                 @default(false)
  source          ListeningHistorySource?
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  track           Track                   @relation(fields: [trackId], references: [id], onDelete: Restrict)

  @@index([userId, playedAt])
  @@index([userId, trackId, playedAt])
  @@index([trackId, playedAt])
}
`,
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"image","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"},{"name":"playlists","kind":"object","type":"Playlist","relationName":"PlaylistToUser"},{"name":"trackLikes","kind":"object","type":"TrackLike","relationName":"TrackLikeToUser"},{"name":"history","kind":"object","type":"ListeningHistory","relationName":"ListeningHistoryToUser"},{"name":"uploads","kind":"object","type":"Upload","relationName":"UploadToUser"}],"dbName":"user","schema":null},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"token","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session","schema":null},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"issuer","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"account","schema":null},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification","schema":null},"Artist":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"bio","kind":"scalar","type":"String"},{"name":"imageAssetId","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PublicationStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"albums","kind":"object","type":"Album","relationName":"AlbumToArtist"},{"name":"trackCredits","kind":"object","type":"TrackArtist","relationName":"ArtistToTrackArtist"},{"name":"imageAsset","kind":"object","type":"MediaAsset","relationName":"ArtistImage"}],"dbName":null,"schema":null},"Album":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"artistId","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"coverAssetId","kind":"scalar","type":"String"},{"name":"releaseDate","kind":"scalar","type":"DateTime"},{"name":"status","kind":"enum","type":"PublicationStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"artist","kind":"object","type":"Artist","relationName":"AlbumToArtist"},{"name":"tracks","kind":"object","type":"Track","relationName":"AlbumToTrack"},{"name":"coverAsset","kind":"object","type":"MediaAsset","relationName":"AlbumCover"}],"dbName":null,"schema":null},"Track":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"albumId","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"trackNumber","kind":"scalar","type":"Int"},{"name":"discNumber","kind":"scalar","type":"Int"},{"name":"durationSeconds","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"PublicationStatus"},{"name":"mediaAssetId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"album","kind":"object","type":"Album","relationName":"AlbumToTrack"},{"name":"mediaAsset","kind":"object","type":"MediaAsset","relationName":"TrackAudio"},{"name":"artists","kind":"object","type":"TrackArtist","relationName":"TrackToTrackArtist"},{"name":"playlistTracks","kind":"object","type":"PlaylistTrack","relationName":"PlaylistTrackToTrack"},{"name":"likes","kind":"object","type":"TrackLike","relationName":"TrackToTrackLike"},{"name":"history","kind":"object","type":"ListeningHistory","relationName":"ListeningHistoryToTrack"},{"name":"uploads","kind":"object","type":"Upload","relationName":"TrackToUpload"}],"dbName":null,"schema":null},"Upload":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"trackId","kind":"scalar","type":"String"},{"name":"initiatedByUserId","kind":"scalar","type":"String"},{"name":"mediaAssetId","kind":"scalar","type":"String"},{"name":"provider","kind":"scalar","type":"String"},{"name":"bucket","kind":"scalar","type":"String"},{"name":"objectKey","kind":"scalar","type":"String"},{"name":"originalFilename","kind":"scalar","type":"String"},{"name":"expectedMimeType","kind":"scalar","type":"String"},{"name":"expectedByteSize","kind":"scalar","type":"BigInt"},{"name":"checksum","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"UploadStatus"},{"name":"failureCode","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"completedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"track","kind":"object","type":"Track","relationName":"TrackToUpload"},{"name":"initiatedBy","kind":"object","type":"User","relationName":"UploadToUser"},{"name":"mediaAsset","kind":"object","type":"MediaAsset","relationName":"MediaAssetToUpload"}],"dbName":null,"schema":null},"TrackArtist":{"fields":[{"name":"trackId","kind":"scalar","type":"String"},{"name":"artistId","kind":"scalar","type":"String"},{"name":"creditType","kind":"enum","type":"TrackCreditType"},{"name":"position","kind":"scalar","type":"Int"},{"name":"track","kind":"object","type":"Track","relationName":"TrackToTrackArtist"},{"name":"artist","kind":"object","type":"Artist","relationName":"ArtistToTrackArtist"}],"dbName":null,"schema":null},"MediaAsset":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"kind","kind":"enum","type":"MediaKind"},{"name":"storageProvider","kind":"scalar","type":"String"},{"name":"bucket","kind":"scalar","type":"String"},{"name":"objectKey","kind":"scalar","type":"String"},{"name":"mimeType","kind":"scalar","type":"String"},{"name":"byteSize","kind":"scalar","type":"BigInt"},{"name":"checksum","kind":"scalar","type":"String"},{"name":"durationSeconds","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"MediaStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"audioTrack","kind":"object","type":"Track","relationName":"TrackAudio"},{"name":"albumCover","kind":"object","type":"Album","relationName":"AlbumCover"},{"name":"artistImage","kind":"object","type":"Artist","relationName":"ArtistImage"},{"name":"uploads","kind":"object","type":"Upload","relationName":"MediaAssetToUpload"}],"dbName":null,"schema":null},"Playlist":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"ownerId","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"visibility","kind":"enum","type":"PlaylistVisibility"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"owner","kind":"object","type":"User","relationName":"PlaylistToUser"},{"name":"tracks","kind":"object","type":"PlaylistTrack","relationName":"PlaylistToPlaylistTrack"}],"dbName":null,"schema":null},"PlaylistTrack":{"fields":[{"name":"playlistId","kind":"scalar","type":"String"},{"name":"trackId","kind":"scalar","type":"String"},{"name":"position","kind":"scalar","type":"Int"},{"name":"addedAt","kind":"scalar","type":"DateTime"},{"name":"playlist","kind":"object","type":"Playlist","relationName":"PlaylistToPlaylistTrack"},{"name":"track","kind":"object","type":"Track","relationName":"PlaylistTrackToTrack"}],"dbName":null,"schema":null},"TrackLike":{"fields":[{"name":"userId","kind":"scalar","type":"String"},{"name":"trackId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"TrackLikeToUser"},{"name":"track","kind":"object","type":"Track","relationName":"TrackToTrackLike"}],"dbName":null,"schema":null},"ListeningHistory":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"trackId","kind":"scalar","type":"String"},{"name":"playedAt","kind":"scalar","type":"DateTime"},{"name":"progressSeconds","kind":"scalar","type":"Int"},{"name":"completed","kind":"scalar","type":"Boolean"},{"name":"source","kind":"enum","type":"ListeningHistorySource"},{"name":"user","kind":"object","type":"User","relationName":"ListeningHistoryToUser"},{"name":"track","kind":"object","type":"Track","relationName":"ListeningHistoryToTrack"}],"dbName":null,"schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","owner","playlist","albums","track","artist","trackCredits","audioTrack","albumCover","artistImage","initiatedBy","mediaAsset","uploads","_count","imageAsset","tracks","coverAsset","album","artists","playlistTracks","likes","history","playlists","trackLikes","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","Artist.findUnique","Artist.findUniqueOrThrow","Artist.findFirst","Artist.findFirstOrThrow","Artist.findMany","Artist.createOne","Artist.createMany","Artist.createManyAndReturn","Artist.updateOne","Artist.updateMany","Artist.updateManyAndReturn","Artist.upsertOne","Artist.deleteOne","Artist.deleteMany","Artist.groupBy","Artist.aggregate","Album.findUnique","Album.findUniqueOrThrow","Album.findFirst","Album.findFirstOrThrow","Album.findMany","Album.createOne","Album.createMany","Album.createManyAndReturn","Album.updateOne","Album.updateMany","Album.updateManyAndReturn","Album.upsertOne","Album.deleteOne","Album.deleteMany","Album.groupBy","Album.aggregate","Track.findUnique","Track.findUniqueOrThrow","Track.findFirst","Track.findFirstOrThrow","Track.findMany","Track.createOne","Track.createMany","Track.createManyAndReturn","Track.updateOne","Track.updateMany","Track.updateManyAndReturn","Track.upsertOne","Track.deleteOne","Track.deleteMany","_avg","_sum","Track.groupBy","Track.aggregate","Upload.findUnique","Upload.findUniqueOrThrow","Upload.findFirst","Upload.findFirstOrThrow","Upload.findMany","Upload.createOne","Upload.createMany","Upload.createManyAndReturn","Upload.updateOne","Upload.updateMany","Upload.updateManyAndReturn","Upload.upsertOne","Upload.deleteOne","Upload.deleteMany","Upload.groupBy","Upload.aggregate","TrackArtist.findUnique","TrackArtist.findUniqueOrThrow","TrackArtist.findFirst","TrackArtist.findFirstOrThrow","TrackArtist.findMany","TrackArtist.createOne","TrackArtist.createMany","TrackArtist.createManyAndReturn","TrackArtist.updateOne","TrackArtist.updateMany","TrackArtist.updateManyAndReturn","TrackArtist.upsertOne","TrackArtist.deleteOne","TrackArtist.deleteMany","TrackArtist.groupBy","TrackArtist.aggregate","MediaAsset.findUnique","MediaAsset.findUniqueOrThrow","MediaAsset.findFirst","MediaAsset.findFirstOrThrow","MediaAsset.findMany","MediaAsset.createOne","MediaAsset.createMany","MediaAsset.createManyAndReturn","MediaAsset.updateOne","MediaAsset.updateMany","MediaAsset.updateManyAndReturn","MediaAsset.upsertOne","MediaAsset.deleteOne","MediaAsset.deleteMany","MediaAsset.groupBy","MediaAsset.aggregate","Playlist.findUnique","Playlist.findUniqueOrThrow","Playlist.findFirst","Playlist.findFirstOrThrow","Playlist.findMany","Playlist.createOne","Playlist.createMany","Playlist.createManyAndReturn","Playlist.updateOne","Playlist.updateMany","Playlist.updateManyAndReturn","Playlist.upsertOne","Playlist.deleteOne","Playlist.deleteMany","Playlist.groupBy","Playlist.aggregate","PlaylistTrack.findUnique","PlaylistTrack.findUniqueOrThrow","PlaylistTrack.findFirst","PlaylistTrack.findFirstOrThrow","PlaylistTrack.findMany","PlaylistTrack.createOne","PlaylistTrack.createMany","PlaylistTrack.createManyAndReturn","PlaylistTrack.updateOne","PlaylistTrack.updateMany","PlaylistTrack.updateManyAndReturn","PlaylistTrack.upsertOne","PlaylistTrack.deleteOne","PlaylistTrack.deleteMany","PlaylistTrack.groupBy","PlaylistTrack.aggregate","TrackLike.findUnique","TrackLike.findUniqueOrThrow","TrackLike.findFirst","TrackLike.findFirstOrThrow","TrackLike.findMany","TrackLike.createOne","TrackLike.createMany","TrackLike.createManyAndReturn","TrackLike.updateOne","TrackLike.updateMany","TrackLike.updateManyAndReturn","TrackLike.upsertOne","TrackLike.deleteOne","TrackLike.deleteMany","TrackLike.groupBy","TrackLike.aggregate","ListeningHistory.findUnique","ListeningHistory.findUniqueOrThrow","ListeningHistory.findFirst","ListeningHistory.findFirstOrThrow","ListeningHistory.findMany","ListeningHistory.createOne","ListeningHistory.createMany","ListeningHistory.createManyAndReturn","ListeningHistory.updateOne","ListeningHistory.updateMany","ListeningHistory.updateManyAndReturn","ListeningHistory.upsertOne","ListeningHistory.deleteOne","ListeningHistory.deleteMany","ListeningHistory.groupBy","ListeningHistory.aggregate","AND","OR","NOT","id","userId","trackId","playedAt","progressSeconds","completed","ListeningHistorySource","source","equals","in","notIn","not","lt","lte","gt","gte","contains","startsWith","endsWith","createdAt","playlistId","position","addedAt","ownerId","name","description","PlaylistVisibility","visibility","updatedAt","MediaKind","kind","storageProvider","bucket","objectKey","mimeType","byteSize","checksum","durationSeconds","MediaStatus","status","bucket_objectKey","every","some","none","artistId","TrackCreditType","creditType","initiatedByUserId","mediaAssetId","provider","originalFilename","expectedMimeType","expectedByteSize","UploadStatus","failureCode","expiresAt","completedAt","albumId","title","slug","trackNumber","discNumber","PublicationStatus","coverAssetId","releaseDate","bio","imageAssetId","identifier","value","accountId","providerId","issuer","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","email","emailVerified","image","Role","role","userId_trackId","albumId_discNumber_trackNumber","trackId_position","trackId_artistId","playlistId_position","playlistId_trackId","ownerId_name","issuer_accountId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","increment","decrement","multiply","divide"]'),
  graph: "3geDAeABEQQAAOgDACAFAADpAwAgEQAAxAMAIBoAAOwDACAbAADqAwAgHAAA6wMAIIUCAADlAwAwhgIAAEsAEIcCAADlAwAwiAIBAAAAAZsCQADAAwAhoAIBALsDACGkAkAAwAMAIdoCAQAAAAHbAiAA5gMAIdwCAQC9AwAh3gIAAOcD3gIiAQAAAAEAIAwDAADwAwAghQIAAI8EADCGAgAAAwAQhwIAAI8EADCIAgEAuwMAIYkCAQC7AwAhmwJAAMADACGkAkAAwAMAIb8CQADAAwAh1wIBALsDACHYAgEAvQMAIdkCAQC9AwAhAwMAAOwGACDYAgAAkAQAINkCAACQBAAgDAMAAPADACCFAgAAjwQAMIYCAAADABCHAgAAjwQAMIgCAQAAAAGJAgEAuwMAIZsCQADAAwAhpAJAAMADACG_AkAAwAMAIdcCAQAAAAHYAgEAvQMAIdkCAQC9AwAhAwAAAAMAIAEAAAQAMAIAAAUAIBIDAADwAwAghQIAAI4EADCGAgAABwAQhwIAAI4EADCIAgEAuwMAIYkCAQC7AwAhmwJAAMADACGkAkAAwAMAIc0CAQC7AwAhzgIBALsDACHPAgEAuwMAIdACAQC9AwAh0QIBAL0DACHSAgEAvQMAIdMCQAD9AwAh1AJAAP0DACHVAgEAvQMAIdYCAQC9AwAhCAMAAOwGACDQAgAAkAQAINECAACQBAAg0gIAAJAEACDTAgAAkAQAINQCAACQBAAg1QIAAJAEACDWAgAAkAQAIBMDAADwAwAghQIAAI4EADCGAgAABwAQhwIAAI4EADCIAgEAAAABiQIBALsDACGbAkAAwAMAIaQCQADAAwAhzQIBALsDACHOAgEAuwMAIc8CAQC7AwAh0AIBAL0DACHRAgEAvQMAIdICAQC9AwAh0wJAAP0DACHUAkAA_QMAIdUCAQC9AwAh1gIBAL0DACHmAgAAjQQAIAMAAAAHACABAAAIADACAAAJACAMBgAA8AMAIBQAAPkDACCFAgAAiwQAMIYCAAALABCHAgAAiwQAMIgCAQDuAwAhmwJAAMADACGfAgEAuwMAIaACAQC7AwAhoQIBAL0DACGjAgAAjASjAiKkAkAAwAMAIQMGAADsBgAgFAAA7QYAIKECAACQBAAgDQYAAPADACAUAAD5AwAghQIAAIsEADCGAgAACwAQhwIAAIsEADCIAgEAAAABmwJAAMADACGfAgEAuwMAIaACAQC7AwAhoQIBAL0DACGjAgAAjASjAiKkAkAAwAMAIeUCAACKBAAgAwAAAAsAIAEAAAwAMAIAAA0AIAkHAACJBAAgCQAA8QMAIIUCAACIBAAwhgIAAA8AEIcCAACIBAAwigIBAO4DACGcAgEA7gMAIZ0CAgD3AwAhngJAAMADACECBwAA7wYAIAkAAO0FACALBwAAiQQAIAkAAPEDACCFAgAAiAQAMIYCAAAPABCHAgAAiAQAMIoCAQDuAwAhnAIBAO4DACGdAgIA9wMAIZ4CQADAAwAh4wIAAIYEACDkAgAAhwQAIAMAAAAPACABAAAQADACAAARACAQCgAAgwQAIBQAAIUEACAVAADcAwAghQIAAIQEADCGAgAAEwAQhwIAAIQEADCIAgEA7gMAIZsCQADAAwAhoQIBAL0DACGkAkAAwAMAIa8CAADZA8cCIrQCAQDuAwAhwgIBALsDACHDAgEAuwMAIccCAQD7AwAhyAJAAP0DACEGCgAA7wUAIBQAAO4GACAVAACKBgAgoQIAAJAEACDHAgAAkAQAIMgCAACQBAAgEAoAAIMEACAUAACFBAAgFQAA3AMAIIUCAACEBAAwhgIAABMAEIcCAACEBAAwiAIBAAAAAZsCQADAAwAhoQIBAL0DACGkAkAAwAMAIa8CAADZA8cCIrQCAQDuAwAhwgIBALsDACHDAgEAAAABxwIBAAAAAcgCQAD9AwAhAwAAABMAIAEAABQAMAIAABUAIAkJAADxAwAgCgAAgwQAIIUCAACBBAAwhgIAABcAEIcCAACBBAAwigIBAO4DACGdAgIA9wMAIbQCAQDuAwAhtgIAAIIEtgIiAgkAAO0FACAKAADvBQAgCwkAAPEDACAKAACDBAAghQIAAIEEADCGAgAAFwAQhwIAAIEEADCKAgEA7gMAIZ0CAgD3AwAhtAIBAO4DACG2AgAAggS2AiLhAgAA_wMAIOICAACABAAgAwAAABcAIAEAABgAMAIAABkAIBMMAADBAwAgDQAAwgMAIA4AAMMDACARAADEAwAghQIAALkDADCGAgAAGwAQhwIAALkDADCIAgEA7gMAIZsCQADAAwAhpAJAAMADACGmAgAAugOmAiKnAgEAuwMAIagCAQC7AwAhqQIBALsDACGqAgEAuwMAIasCBAC8AwAhrAIBAL0DACGtAgIAvgMAIa8CAAC_A68CIgEAAAAbACAVEAAA3AMAIBEAAMQDACAWAAD4AwAgFwAA2wMAIBgAAPkDACAZAADrAwAgGgAA7AMAIIUCAAD2AwAwhgIAAB0AEIcCAAD2AwAwiAIBAO4DACGbAkAAwAMAIaQCQADAAwAhrQICAL4DACGvAgAA2QPHAiK4AgEA-wMAIcECAQDuAwAhwgIBALsDACHDAgEAuwMAIcQCAgD3AwAhxQICAPcDACEBAAAAHQAgAQAAABMAIA4IAADaAwAgCwAA2wMAIBMAANwDACCFAgAA2AMAMIYCAAAgABCHAgAA2AMAMIgCAQDuAwAhmwJAAMADACGgAgEAuwMAIaQCQADAAwAhrwIAANkDxwIiwwIBALsDACHJAgEAvQMAIcoCAQD7AwAhAQAAACAAIBcJAADxAwAgDwAA8AMAIBAAANwDACCFAgAA-gMAMIYCAAAiABCHAgAA-gMAMIgCAQDuAwAhigIBAO4DACGbAkAAwAMAIaQCQADAAwAhqAIBALsDACGpAgEAuwMAIawCAQC9AwAhrwIAAPwDvgIitwIBALsDACG4AgEA-wMAIbkCAQC7AwAhugIBALsDACG7AgEAuwMAIbwCBAC8AwAhvgIBAL0DACG_AkAAwAMAIcACQAD9AwAhBwkAAO0FACAPAADsBgAgEAAAigYAIKwCAACQBAAguAIAAJAEACC-AgAAkAQAIMACAACQBAAgFwkAAPEDACAPAADwAwAgEAAA3AMAIIUCAAD6AwAwhgIAACIAEIcCAAD6AwAwiAIBAAAAAYoCAQDuAwAhmwJAAMADACGkAkAAwAMAIagCAQC7AwAhqQIBALsDACGsAgEAvQMAIa8CAAD8A74CIrcCAQC7AwAhuAIBAPsDACG5AgEAuwMAIboCAQC7AwAhuwIBALsDACG8AgQAvAMAIb4CAQC9AwAhvwJAAMADACHAAkAA_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_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_AkAAAAABywIBAAAAAcwCAQAAAAEBIgAAlQEAIAaIAgEAAAABmwJAAAAAAaQCQAAAAAG_AkAAAAABywIBAAAAAcwCAQAAAAEBIgAAlwEAMAEiAACXAQAwBogCAQCWBAAhmwJAAJcEACGkAkAAlwQAIb8CQACXBAAhywIBAJYEACHMAgEAlgQAIQIAAACNAQAgIgAAmgEAIAaIAgEAlgQAIZsCQACXBAAhpAJAAJcEACG_AkAAlwQAIcsCAQCWBAAhzAIBAJYEACECAAAAkAEAICIAAJwBACACAAAAkAEAICIAAJwBACADAAAAjQEAICkAAJUBACAqAACaAQAgAQAAAI0BACABAAAAkAEAIAMSAACLBgAgLwAAjQYAIDAAAIwGACAJhQIAAN0DADCGAgAAowEAEIcCAADdAwAwiAIBAJADACGbAkAAkQMAIaQCQACRAwAhvwJAAJEDACHLAgEAkAMAIcwCAQCQAwAhAwAAAJABACABAACiAQAwLgAAowEAIAMAAACQAQAgAQAAkQEAMAIAAI0BACAOCAAA2gMAIAsAANsDACATAADcAwAghQIAANgDADCGAgAAIAAQhwIAANgDADCIAgEAAAABmwJAAMADACGgAgEAuwMAIaQCQADAAwAhrwIAANkDxwIiwwIBAAAAAckCAQC9AwAhygIBAAAAAQEAAACmAQAgAQAAAKYBACAFCAAAiAYAIAsAAIkGACATAACKBgAgyQIAAJAEACDKAgAAkAQAIAMAAAAgACABAACpAQAwAgAApgEAIAMAAAAgACABAACpAQAwAgAApgEAIAMAAAAgACABAACpAQAwAgAApgEAIAsIAADZBQAgCwAA2gUAIBMAAIcGACCIAgEAAAABmwJAAAAAAaACAQAAAAGkAkAAAAABrwIAAADHAgLDAgEAAAAByQIBAAAAAcoCAQAAAAEBIgAArQEAIAiIAgEAAAABmwJAAAAAAaACAQAAAAGkAkAAAAABrwIAAADHAgLDAgEAAAAByQIBAAAAAcoCAQAAAAEBIgAArwEAMAEiAACvAQAwAQAAABsAIAsIAADpBAAgCwAA6gQAIBMAAIYGACCIAgEAlgQAIZsCQACXBAAhoAIBAJYEACGkAkAAlwQAIa8CAADoBMcCIsMCAQCWBAAhyQIBALMEACHKAgEAswQAIQIAAACmAQAgIgAAswEAIAiIAgEAlgQAIZsCQACXBAAhoAIBAJYEACGkAkAAlwQAIa8CAADoBMcCIsMCAQCWBAAhyQIBALMEACHKAgEAswQAIQIAAAAgACAiAAC1AQAgAgAAACAAICIAALUBACABAAAAGwAgAwAAAKYBACApAACtAQAgKgAAswEAIAEAAACmAQAgAQAAACAAIAUSAACDBgAgLwAAhQYAIDAAAIQGACDJAgAAkAQAIMoCAACQBAAgC4UCAADXAwAwhgIAAL0BABCHAgAA1wMAMIgCAQCPAwAhmwJAAJEDACGgAgEAkAMAIaQCQACRAwAhrwIAANMDxwIiwwIBAJADACHJAgEAqAMAIcoCAQDKAwAhAwAAACAAIAEAALwBADAuAAC9AQAgAwAAACAAIAEAAKkBADACAACmAQAgAQAAABUAIAEAAAAVACADAAAAEwAgAQAAFAAwAgAAFQAgAwAAABMAIAEAABQAMAIAABUAIAMAAAATACABAAAUADACAAAVACANCgAA4QUAIBQAANcFACAVAADYBQAgiAIBAAAAAZsCQAAAAAGhAgEAAAABpAJAAAAAAa8CAAAAxwICtAIBAAAAAcICAQAAAAHDAgEAAAABxwIBAAAAAcgCQAAAAAEBIgAAxQEAIAqIAgEAAAABmwJAAAAAAaECAQAAAAGkAkAAAAABrwIAAADHAgK0AgEAAAABwgIBAAAAAcMCAQAAAAHHAgEAAAAByAJAAAAAAQEiAADHAQAwASIAAMcBADABAAAAGwAgDQoAAOAFACAUAACFBQAgFQAAhgUAIIgCAQCWBAAhmwJAAJcEACGhAgEAswQAIaQCQACXBAAhrwIAAOgExwIitAIBAJYEACHCAgEAlgQAIcMCAQCWBAAhxwIBALMEACHIAkAA3AQAIQIAAAAVACAiAADLAQAgCogCAQCWBAAhmwJAAJcEACGhAgEAswQAIaQCQACXBAAhrwIAAOgExwIitAIBAJYEACHCAgEAlgQAIcMCAQCWBAAhxwIBALMEACHIAkAA3AQAIQIAAAATACAiAADNAQAgAgAAABMAICIAAM0BACABAAAAGwAgAwAAABUAICkAAMUBACAqAADLAQAgAQAAABUAIAEAAAATACAGEgAAgAYAIC8AAIIGACAwAACBBgAgoQIAAJAEACDHAgAAkAQAIMgCAACQBAAgDYUCAADWAwAwhgIAANUBABCHAgAA1gMAMIgCAQCPAwAhmwJAAJEDACGhAgEAqAMAIaQCQACRAwAhrwIAANMDxwIitAIBAI8DACHCAgEAkAMAIcMCAQCQAwAhxwIBAMoDACHIAkAAzAMAIQMAAAATACABAADUAQAwLgAA1QEAIAMAAAATACABAAAUADACAAAVACABAAAAKwAgAQAAACsAIAMAAAAdACABAAAqADACAAArACADAAAAHQAgAQAAKgAwAgAAKwAgAwAAAB0AIAEAACoAMAIAACsAIBIQAADQBQAgEQAA1QUAIBYAAOgFACAXAADRBQAgGAAA0gUAIBkAANMFACAaAADUBQAgiAIBAAAAAZsCQAAAAAGkAkAAAAABrQICAAAAAa8CAAAAxwICuAIBAAAAAcECAQAAAAHCAgEAAAABwwIBAAAAAcQCAgAAAAHFAgIAAAABASIAAN0BACALiAIBAAAAAZsCQAAAAAGkAkAAAAABrQICAAAAAa8CAAAAxwICuAIBAAAAAcECAQAAAAHCAgEAAAABwwIBAAAAAcQCAgAAAAHFAgIAAAABASIAAN8BADABIgAA3wEAMAEAAAAbACASEAAAkgUAIBEAAJcFACAWAADnBQAgFwAAkwUAIBgAAJQFACAZAACVBQAgGgAAlgUAIIgCAQCWBAAhmwJAAJcEACGkAkAAlwQAIa0CAgCYBAAhrwIAAOgExwIiuAIBALMEACHBAgEAlgQAIcICAQCWBAAhwwIBAJYEACHEAgIAqwQAIcUCAgCrBAAhAgAAACsAICIAAOMBACALiAIBAJYEACGbAkAAlwQAIaQCQACXBAAhrQICAJgEACGvAgAA6ATHAiK4AgEAswQAIcECAQCWBAAhwgIBAJYEACHDAgEAlgQAIcQCAgCrBAAhxQICAKsEACECAAAAHQAgIgAA5QEAIAIAAAAdACAiAADlAQAgAQAAABsAIAMAAAArACApAADdAQAgKgAA4wEAIAEAAAArACABAAAAHQAgBxIAAPsFACAvAAD-BQAgMAAA_QUAIJEBAAD8BQAgkgEAAP8FACCtAgAAkAQAILgCAACQBAAgDoUCAADSAwAwhgIAAO0BABCHAgAA0gMAMIgCAQCPAwAhmwJAAJEDACGkAkAAkQMAIa0CAgCSAwAhrwIAANMDxwIiuAIBAMoDACHBAgEAjwMAIcICAQCQAwAhwwIBAJADACHEAgIApAMAIcUCAgCkAwAhAwAAAB0AIAEAAOwBADAuAADtAQAgAwAAAB0AIAEAACoAMAIAACsAIAEAAAAkACABAAAAJAAgAwAAACIAIAEAACMAMAIAACQAIAMAAAAiACABAAAjADACAAAkACADAAAAIgAgAQAAIwAwAgAAJAAgFAkAAOEEACAPAADiBAAgEAAAogUAIIgCAQAAAAGKAgEAAAABmwJAAAAAAaQCQAAAAAGoAgEAAAABqQIBAAAAAawCAQAAAAGvAgAAAL4CArcCAQAAAAG4AgEAAAABuQIBAAAAAboCAQAAAAG7AgEAAAABvAIEAAAAAb4CAQAAAAG_AkAAAAABwAJAAAAAAQEiAAD1AQAgEYgCAQAAAAGKAgEAAAABmwJAAAAAAaQCQAAAAAGoAgEAAAABqQIBAAAAAawCAQAAAAGvAgAAAL4CArcCAQAAAAG4AgEAAAABuQIBAAAAAboCAQAAAAG7AgEAAAABvAIEAAAAAb4CAQAAAAG_AkAAAAABwAJAAAAAAQEiAAD3AQAwASIAAPcBADABAAAAGwAgFAkAAN4EACAPAADfBAAgEAAAoAUAIIgCAQCWBAAhigIBAJYEACGbAkAAlwQAIaQCQACXBAAhqAIBAJYEACGpAgEAlgQAIawCAQCzBAAhrwIAANsEvgIitwIBAJYEACG4AgEAswQAIbkCAQCWBAAhugIBAJYEACG7AgEAlgQAIbwCBADLBAAhvgIBALMEACG_AkAAlwQAIcACQADcBAAhAgAAACQAICIAAPsBACARiAIBAJYEACGKAgEAlgQAIZsCQACXBAAhpAJAAJcEACGoAgEAlgQAIakCAQCWBAAhrAIBALMEACGvAgAA2wS-AiK3AgEAlgQAIbgCAQCzBAAhuQIBAJYEACG6AgEAlgQAIbsCAQCWBAAhvAIEAMsEACG-AgEAswQAIb8CQACXBAAhwAJAANwEACECAAAAIgAgIgAA_QEAIAIAAAAiACAiAAD9AQAgAQAAABsAIAMAAAAkACApAAD1AQAgKgAA-wEAIAEAAAAkACABAAAAIgAgCRIAAPYFACAvAAD5BQAgMAAA-AUAIJEBAAD3BQAgkgEAAPoFACCsAgAAkAQAILgCAACQBAAgvgIAAJAEACDAAgAAkAQAIBSFAgAAyQMAMIYCAACFAgAQhwIAAMkDADCIAgEAjwMAIYoCAQCPAwAhmwJAAJEDACGkAkAAkQMAIagCAQCQAwAhqQIBAJADACGsAgEAqAMAIa8CAADLA74CIrcCAQCQAwAhuAIBAMoDACG5AgEAkAMAIboCAQCQAwAhuwIBAJADACG8AgQAsAMAIb4CAQCoAwAhvwJAAJEDACHAAkAAzAMAIQMAAAAiACABAACEAgAwLgAAhQIAIAMAAAAiACABAAAjADACAAAkACABAAAAGQAgAQAAABkAIAMAAAAXACABAAAYADACAAAZACADAAAAFwAgAQAAGAAwAgAAGQAgAwAAABcAIAEAABgAMAIAABkAIAYJAAD5BAAgCgAAzgUAIIoCAQAAAAGdAgIAAAABtAIBAAAAAbYCAAAAtgICASIAAI0CACAEigIBAAAAAZ0CAgAAAAG0AgEAAAABtgIAAAC2AgIBIgAAjwIAMAEiAACPAgAwBgkAAPcEACAKAADMBQAgigIBAJYEACGdAgIAqwQAIbQCAQCWBAAhtgIAAPUEtgIiAgAAABkAICIAAJICACAEigIBAJYEACGdAgIAqwQAIbQCAQCWBAAhtgIAAPUEtgIiAgAAABcAICIAAJQCACACAAAAFwAgIgAAlAIAIAMAAAAZACApAACNAgAgKgAAkgIAIAEAAAAZACABAAAAFwAgBRIAAPEFACAvAAD0BQAgMAAA8wUAIJEBAADyBQAgkgEAAPUFACAHhQIAAMUDADCGAgAAmwIAEIcCAADFAwAwigIBAI8DACGdAgIApAMAIbQCAQCPAwAhtgIAAMYDtgIiAwAAABcAIAEAAJoCADAuAACbAgAgAwAAABcAIAEAABgAMAIAABkAIBQMAADBAwAgDQAAwgMAIA4AAMMDACARAADEAwAghQIAALkDADCGAgAAGwAQhwIAALkDADCIAgEAAAABmwJAAMADACGkAkAAwAMAIaYCAAC6A6YCIqcCAQC7AwAhqAIBALsDACGpAgEAuwMAIaoCAQC7AwAhqwIEALwDACGsAgEAvQMAIa0CAgC-AwAhrwIAAL8DrwIisAIAALgDACABAAAAngIAIAEAAACeAgAgBgwAAO0FACANAADuBQAgDgAA7wUAIBEAAPAFACCsAgAAkAQAIK0CAACQBAAgAwAAABsAIAEAAKECADACAACeAgAgAwAAABsAIAEAAKECADACAACeAgAgAwAAABsAIAEAAKECADACAACeAgAgEAwAAOkFACANAADqBQAgDgAA6wUAIBEAAOwFACCIAgEAAAABmwJAAAAAAaQCQAAAAAGmAgAAAKYCAqcCAQAAAAGoAgEAAAABqQIBAAAAAaoCAQAAAAGrAgQAAAABrAIBAAAAAa0CAgAAAAGvAgAAAK8CAgEiAAClAgAgDIgCAQAAAAGbAkAAAAABpAJAAAAAAaYCAAAApgICpwIBAAAAAagCAQAAAAGpAgEAAAABqgIBAAAAAasCBAAAAAGsAgEAAAABrQICAAAAAa8CAAAArwICASIAAKcCADABIgAApwIAMBAMAADNBAAgDQAAzgQAIA4AAM8EACARAADQBAAgiAIBAJYEACGbAkAAlwQAIaQCQACXBAAhpgIAAMoEpgIipwIBAJYEACGoAgEAlgQAIakCAQCWBAAhqgIBAJYEACGrAgQAywQAIawCAQCzBAAhrQICAJgEACGvAgAAzASvAiICAAAAngIAICIAAKoCACAMiAIBAJYEACGbAkAAlwQAIaQCQACXBAAhpgIAAMoEpgIipwIBAJYEACGoAgEAlgQAIakCAQCWBAAhqgIBAJYEACGrAgQAywQAIawCAQCzBAAhrQICAJgEACGvAgAAzASvAiICAAAAGwAgIgAArAIAIAIAAAAbACAiAACsAgAgAwAAAJ4CACApAAClAgAgKgAAqgIAIAEAAACeAgAgAQAAABsAIAcSAADFBAAgLwAAyAQAIDAAAMcEACCRAQAAxgQAIJIBAADJBAAgrAIAAJAEACCtAgAAkAQAIA-FAgAArgMAMIYCAACzAgAQhwIAAK4DADCIAgEAjwMAIZsCQACRAwAhpAJAAJEDACGmAgAArwOmAiKnAgEAkAMAIagCAQCQAwAhqQIBAJADACGqAgEAkAMAIasCBACwAwAhrAIBAKgDACGtAgIAkgMAIa8CAACxA68CIgMAAAAbACABAACyAgAwLgAAswIAIAMAAAAbACABAAChAgAwAgAAngIAIAEAAAANACABAAAADQAgAwAAAAsAIAEAAAwAMAIAAA0AIAMAAAALACABAAAMADACAAANACADAAAACwAgAQAADAAwAgAADQAgCQYAAMMEACAUAADEBAAgiAIBAAAAAZsCQAAAAAGfAgEAAAABoAIBAAAAAaECAQAAAAGjAgAAAKMCAqQCQAAAAAEBIgAAuwIAIAeIAgEAAAABmwJAAAAAAZ8CAQAAAAGgAgEAAAABoQIBAAAAAaMCAAAAowICpAJAAAAAAQEiAAC9AgAwASIAAL0CADAJBgAAtQQAIBQAALYEACCIAgEAlgQAIZsCQACXBAAhnwIBAJYEACGgAgEAlgQAIaECAQCzBAAhowIAALQEowIipAJAAJcEACECAAAADQAgIgAAwAIAIAeIAgEAlgQAIZsCQACXBAAhnwIBAJYEACGgAgEAlgQAIaECAQCzBAAhowIAALQEowIipAJAAJcEACECAAAACwAgIgAAwgIAIAIAAAALACAiAADCAgAgAwAAAA0AICkAALsCACAqAADAAgAgAQAAAA0AIAEAAAALACAEEgAAsAQAIC8AALIEACAwAACxBAAgoQIAAJAEACAKhQIAAKcDADCGAgAAyQIAEIcCAACnAwAwiAIBAI8DACGbAkAAkQMAIZ8CAQCQAwAhoAIBAJADACGhAgEAqAMAIaMCAACpA6MCIqQCQACRAwAhAwAAAAsAIAEAAMgCADAuAADJAgAgAwAAAAsAIAEAAAwAMAIAAA0AIAEAAAARACABAAAAEQAgAwAAAA8AIAEAABAAMAIAABEAIAMAAAAPACABAAAQADACAAARACADAAAADwAgAQAAEAAwAgAAEQAgBgcAAK4EACAJAACvBAAgigIBAAAAAZwCAQAAAAGdAgIAAAABngJAAAAAAQEiAADRAgAgBIoCAQAAAAGcAgEAAAABnQICAAAAAZ4CQAAAAAEBIgAA0wIAMAEiAADTAgAwBgcAAKwEACAJAACtBAAgigIBAJYEACGcAgEAlgQAIZ0CAgCrBAAhngJAAJcEACECAAAAEQAgIgAA1gIAIASKAgEAlgQAIZwCAQCWBAAhnQICAKsEACGeAkAAlwQAIQIAAAAPACAiAADYAgAgAgAAAA8AICIAANgCACADAAAAEQAgKQAA0QIAICoAANYCACABAAAAEQAgAQAAAA8AIAUSAACmBAAgLwAAqQQAIDAAAKgEACCRAQAApwQAIJIBAACqBAAgB4UCAACjAwAwhgIAAN8CABCHAgAAowMAMIoCAQCPAwAhnAIBAI8DACGdAgIApAMAIZ4CQACRAwAhAwAAAA8AIAEAAN4CADAuAADfAgAgAwAAAA8AIAEAABAAMAIAABEAIAEAAAA0ACABAAAANAAgAwAAADIAIAEAADMAMAIAADQAIAMAAAAyACABAAAzADACAAA0ACADAAAAMgAgAQAAMwAwAgAANAAgBQMAAKQEACAJAAClBAAgiQIBAAAAAYoCAQAAAAGbAkAAAAABASIAAOcCACADiQIBAAAAAYoCAQAAAAGbAkAAAAABASIAAOkCADABIgAA6QIAMAUDAACiBAAgCQAAowQAIIkCAQCWBAAhigIBAJYEACGbAkAAlwQAIQIAAAA0ACAiAADsAgAgA4kCAQCWBAAhigIBAJYEACGbAkAAlwQAIQIAAAAyACAiAADuAgAgAgAAADIAICIAAO4CACADAAAANAAgKQAA5wIAICoAAOwCACABAAAANAAgAQAAADIAIAMSAACfBAAgLwAAoQQAIDAAAKAEACAGhQIAAKIDADCGAgAA9QIAEIcCAACiAwAwiQIBAJADACGKAgEAjwMAIZsCQACRAwAhAwAAADIAIAEAAPQCADAuAAD1AgAgAwAAADIAIAEAADMAMAIAADQAIAEAAAA4ACABAAAAOAAgAwAAADYAIAEAADcAMAIAADgAIAMAAAA2ACABAAA3ADACAAA4ACADAAAANgAgAQAANwAwAgAAOAAgCQMAAJ0EACAJAACeBAAgiAIBAAAAAYkCAQAAAAGKAgEAAAABiwJAAAAAAYwCAgAAAAGNAiAAAAABjwIAAACPAgMBIgAA_QIAIAeIAgEAAAABiQIBAAAAAYoCAQAAAAGLAkAAAAABjAICAAAAAY0CIAAAAAGPAgAAAI8CAwEiAAD_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-AgiTAgAA0AO-AiILEgAAlgMAIC8AAK0DACAwAACtAwAgkAIBAAAAAZECAQAAAAWSAgEAAAAFkwIBANEDACGUAgEAAAABlQIBAAAAAZYCAQAAAAGXAgEAAAABDoUCAADSAwAwhgIAAO0BABCHAgAA0gMAMIgCAQCPAwAhmwJAAJEDACGkAkAAkQMAIa0CAgCSAwAhrwIAANMDxwIiuAIBAMoDACHBAgEAjwMAIcICAQCQAwAhwwIBAJADACHEAgIApAMAIcUCAgCkAwAhBxIAAJkDACAvAADVAwAgMAAA1QMAIJACAAAAxwICkQIAAADHAgiSAgAAAMcCCJMCAADUA8cCIgcSAACZAwAgLwAA1QMAIDAAANUDACCQAgAAAMcCApECAAAAxwIIkgIAAADHAgiTAgAA1APHAiIEkAIAAADHAgKRAgAAAMcCCJICAAAAxwIIkwIAANUDxwIiDYUCAADWAwAwhgIAANUBABCHAgAA1gMAMIgCAQCPAwAhmwJAAJEDACGhAgEAqAMAIaQCQACRAwAhrwIAANMDxwIitAIBAI8DACHCAgEAkAMAIcMCAQCQAwAhxwIBAMoDACHIAkAAzAMAIQuFAgAA1wMAMIYCAAC9AQAQhwIAANcDADCIAgEAjwMAIZsCQACRAwAhoAIBAJADACGkAkAAkQMAIa8CAADTA8cCIsMCAQCQAwAhyQIBAKgDACHKAgEAygMAIQ4IAADaAwAgCwAA2wMAIBMAANwDACCFAgAA2AMAMIYCAAAgABCHAgAA2AMAMIgCAQDuAwAhmwJAAMADACGgAgEAuwMAIaQCQADAAwAhrwIAANkDxwIiwwIBALsDACHJAgEAvQMAIcoCAQD7AwAhBJACAAAAxwICkQIAAADHAgiSAgAAAMcCCJMCAADVA8cCIgOxAgAAEwAgsgIAABMAILMCAAATACADsQIAABcAILICAAAXACCzAgAAFwAgFQwAAMEDACANAADCAwAgDgAAwwMAIBEAAMQDACCFAgAAuQMAMIYCAAAbABCHAgAAuQMAMIgCAQDuAwAhmwJAAMADACGkAkAAwAMAIaYCAAC6A6YCIqcCAQC7AwAhqAIBALsDACGpAgEAuwMAIaoCAQC7AwAhqwIEALwDACGsAgEAvQMAIa0CAgC-AwAhrwIAAL8DrwIi5wIAABsAIOgCAAAbACAJhQIAAN0DADCGAgAAowEAEIcCAADdAwAwiAIBAJADACGbAkAAkQMAIaQCQACRAwAhvwJAAJEDACHLAgEAkAMAIcwCAQCQAwAhCYUCAADeAwAwhgIAAJABABCHAgAA3gMAMIgCAQC7AwAhmwJAAMADACGkAkAAwAMAIb8CQADAAwAhywIBALsDACHMAgEAuwMAIRGFAgAA3wMAMIYCAACKAQAQhwIAAN8DADCIAgEAkAMAIYkCAQCQAwAhmwJAAJEDACGkAkAAkQMAIc0CAQCQAwAhzgIBAJADACHPAgEAkAMAIdACAQCoAwAh0QIBAKgDACHSAgEAqAMAIdMCQADMAwAh1AJAAMwDACHVAgEAqAMAIdYCAQCoAwAhC4UCAADgAwAwhgIAAHQAEIcCAADgAwAwiAIBAJADACGJAgEAkAMAIZsCQACRAwAhpAJAAJEDACG_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_AO-AiK3AgEAuwMAIbgCAQD7AwAhuQIBALsDACG6AgEAuwMAIbsCAQC7AwAhvAIEALwDACG-AgEAvQMAIb8CQADAAwAhwAJAAP0DACEIkAIBAAAAAZECAQAAAAWSAgEAAAAFkwIBAP4DACGUAgEAAAABlQIBAAAAAZYCAQAAAAGXAgEAAAABBJACAAAAvgICkQIAAAC-AgiSAgAAAL4CCJMCAADQA74CIgiQAkAAAAABkQJAAAAABZICQAAAAAWTAkAAzgMAIZQCQAAAAAGVAkAAAAABlgJAAAAAAZcCQAAAAAEIkAIBAAAAAZECAQAAAAWSAgEAAAAFkwIBAP4DACGUAgEAAAABlQIBAAAAAZYCAQAAAAGXAgEAAAABAooCAQAAAAGdAgIAAAABAooCAQAAAAG0AgEAAAABCQkAAPEDACAKAACDBAAghQIAAIEEADCGAgAAFwAQhwIAAIEEADCKAgEA7gMAIZ0CAgD3AwAhtAIBAO4DACG2AgAAggS2AiIEkAIAAAC2AgKRAgAAALYCCJICAAAAtgIIkwIAAMgDtgIiEAgAANoDACALAADbAwAgEwAA3AMAIIUCAADYAwAwhgIAACAAEIcCAADYAwAwiAIBAO4DACGbAkAAwAMAIaACAQC7AwAhpAJAAMADACGvAgAA2QPHAiLDAgEAuwMAIckCAQC9AwAhygIBAPsDACHnAgAAIAAg6AIAACAAIBAKAACDBAAgFAAAhQQAIBUAANwDACCFAgAAhAQAMIYCAAATABCHAgAAhAQAMIgCAQDuAwAhmwJAAMADACGhAgEAvQMAIaQCQADAAwAhrwIAANkDxwIitAIBAO4DACHCAgEAuwMAIcMCAQC7AwAhxwIBAPsDACHIAkAA_QMAIQOxAgAAHQAgsgIAAB0AILMCAAAdACACnAIBAAAAAZ0CAgAAAAECigIBAAAAAZwCAQAAAAEJBwAAiQQAIAkAAPEDACCFAgAAiAQAMIYCAAAPABCHAgAAiAQAMIoCAQDuAwAhnAIBAO4DACGdAgIA9wMAIZ4CQADAAwAhDgYAAPADACAUAAD5AwAghQIAAIsEADCGAgAACwAQhwIAAIsEADCIAgEA7gMAIZsCQADAAwAhnwIBALsDACGgAgEAuwMAIaECAQC9AwAhowIAAIwEowIipAJAAMADACHnAgAACwAg6AIAAAsAIAKfAgEAAAABoAIBAAAAAQwGAADwAwAgFAAA-QMAIIUCAACLBAAwhgIAAAsAEIcCAACLBAAwiAIBAO4DACGbAkAAwAMAIZ8CAQC7AwAhoAIBALsDACGhAgEAvQMAIaMCAACMBKMCIqQCQADAAwAhBJACAAAAowICkQIAAACjAgiSAgAAAKMCCJMCAACrA6MCIgLNAgEAAAABzwIBAAAAARIDAADwAwAghQIAAI4EADCGAgAABwAQhwIAAI4EADCIAgEAuwMAIYkCAQC7AwAhmwJAAMADACGkAkAAwAMAIc0CAQC7AwAhzgIBALsDACHPAgEAuwMAIdACAQC9AwAh0QIBAL0DACHSAgEAvQMAIdMCQAD9AwAh1AJAAP0DACHVAgEAvQMAIdYCAQC9AwAhDAMAAPADACCFAgAAjwQAMIYCAAADABCHAgAAjwQAMIgCAQC7AwAhiQIBALsDACGbAkAAwAMAIaQCQADAAwAhvwJAAMADACHXAgEAuwMAIdgCAQC9AwAh2QIBAL0DACEAAAAAAAAB7AIBAAAAAQHsAkAAAAABBewCAgAAAAHyAgIAAAAB8wICAAAAAfQCAgAAAAH1AgIAAAABAewCIAAAAAEB7AIAAACPAgMFKQAA1wcAICoAAN0HACDpAgAA2AcAIOoCAADcBwAg7wIAAAEAIAUpAADVBwAgKgAA2gcAIOkCAADWBwAg6gIAANkHACDvAgAAKwAgAykAANcHACDpAgAA2AcAIO8CAAABACADKQAA1QcAIOkCAADWBwAg7wIAACsAIAAAAAUpAADNBwAgKgAA0wcAIOkCAADOBwAg6gIAANIHACDvAgAAAQAgBSkAAMsHACAqAADQBwAg6QIAAMwHACDqAgAAzwcAIO8CAAArACADKQAAzQcAIOkCAADOBwAg7wIAAAEAIAMpAADLBwAg6QIAAMwHACDvAgAAKwAgAAAAAAAF7AICAAAAAfICAgAAAAHzAgIAAAAB9AICAAAAAfUCAgAAAAEFKQAAwwcAICoAAMkHACDpAgAAxAcAIOoCAADIBwAg7wIAAA0AIAUpAADBBwAgKgAAxgcAIOkCAADCBwAg6gIAAMUHACDvAgAAKwAgAykAAMMHACDpAgAAxAcAIO8CAAANACADKQAAwQcAIOkCAADCBwAg7wIAACsAIAAAAAHsAgEAAAABAewCAAAAowICBSkAALsHACAqAAC_BwAg6QIAALwHACDqAgAAvgcAIO8CAAABACALKQAAtwQAMCoAALwEADDpAgAAuAQAMOoCAAC5BAAw6wIAALoEACDsAgAAuwQAMO0CAAC7BAAw7gIAALsEADDvAgAAuwQAMPACAAC9BAAw8QIAAL4EADAECQAArwQAIIoCAQAAAAGdAgIAAAABngJAAAAAAQIAAAARACApAADCBAAgAwAAABEAICkAAMIEACAqAADBBAAgASIAAL0HADALBwAAiQQAIAkAAPEDACCFAgAAiAQAMIYCAAAPABCHAgAAiAQAMIoCAQDuAwAhnAIBAO4DACGdAgIA9wMAIZ4CQADAAwAh4wIAAIYEACDkAgAAhwQAIAIAAAARACAiAADBBAAgAgAAAL8EACAiAADABAAgB4UCAAC-BAAwhgIAAL8EABCHAgAAvgQAMIoCAQDuAwAhnAIBAO4DACGdAgIA9wMAIZ4CQADAAwAhB4UCAAC-BAAwhgIAAL8EABCHAgAAvgQAMIoCAQDuAwAhnAIBAO4DACGdAgIA9wMAIZ4CQADAAwAhA4oCAQCWBAAhnQICAKsEACGeAkAAlwQAIQQJAACtBAAgigIBAJYEACGdAgIAqwQAIZ4CQACXBAAhBAkAAK8EACCKAgEAAAABnQICAAAAAZ4CQAAAAAEDKQAAuwcAIOkCAAC8BwAg7wIAAAEAIAQpAAC3BAAw6QIAALgEADDrAgAAugQAIO8CAAC7BAAwAAAAAAAB7AIAAACmAgIF7AIEAAAAAfICBAAAAAHzAgQAAAAB9AIEAAAAAfUCBAAAAAEB7AIAAACvAgIHKQAA4gUAICoAAOUFACDpAgAA4wUAIOoCAADkBQAg7QIAAB0AIO4CAAAdACDvAgAAKwAgBykAANsFACAqAADeBQAg6QIAANwFACDqAgAA3QUAIO0CAAATACDuAgAAEwAg7wIAABUAIAcpAADjBAAgKgAA5gQAIOkCAADkBAAg6gIAAOUEACDtAgAAIAAg7gIAACAAIO8CAACmAQAgCykAANEEADAqAADWBAAw6QIAANIEADDqAgAA0wQAMOsCAADUBAAg7AIAANUEADDtAgAA1QQAMO4CAADVBAAw7wIAANUEADDwAgAA1wQAMPECAADYBAAwEgkAAOEEACAPAADiBAAgiAIBAAAAAYoCAQAAAAGbAkAAAAABpAJAAAAAAagCAQAAAAGpAgEAAAABrAIBAAAAAa8CAAAAvgICtwIBAAAAAbkCAQAAAAG6AgEAAAABuwIBAAAAAbwCBAAAAAG-AgEAAAABvwJAAAAAAcACQAAAAAECAAAAJAAgKQAA4AQAIAMAAAAkACApAADgBAAgKgAA3QQAIAEiAAC6BwAwFwkAAPEDACAPAADwAwAgEAAA3AMAIIUCAAD6AwAwhgIAACIAEIcCAAD6AwAwiAIBAAAAAYoCAQDuAwAhmwJAAMADACGkAkAAwAMAIagCAQC7AwAhqQIBALsDACGsAgEAvQMAIa8CAAD8A74CIrcCAQC7AwAhuAIBAPsDACG5AgEAuwMAIboCAQC7AwAhuwIBALsDACG8AgQAvAMAIb4CAQC9AwAhvwJAAMADACHAAkAA_QMAIQIAAAAkACAiAADdBAAgAgAAANkEACAiAADaBAAgFIUCAADYBAAwhgIAANkEABCHAgAA2AQAMIgCAQDuAwAhigIBAO4DACGbAkAAwAMAIaQCQADAAwAhqAIBALsDACGpAgEAuwMAIawCAQC9AwAhrwIAAPwDvgIitwIBALsDACG4AgEA-wMAIbkCAQC7AwAhugIBALsDACG7AgEAuwMAIbwCBAC8AwAhvgIBAL0DACG_AkAAwAMAIcACQAD9AwAhFIUCAADYBAAwhgIAANkEABCHAgAA2AQAMIgCAQDuAwAhigIBAO4DACGbAkAAwAMAIaQCQADAAwAhqAIBALsDACGpAgEAuwMAIawCAQC9AwAhrwIAAPwDvgIitwIBALsDACG4AgEA-wMAIbkCAQC7AwAhugIBALsDACG7AgEAuwMAIbwCBAC8AwAhvgIBAL0DACG_AkAAwAMAIcACQAD9AwAhEIgCAQCWBAAhigIBAJYEACGbAkAAlwQAIaQCQACXBAAhqAIBAJYEACGpAgEAlgQAIawCAQCzBAAhrwIAANsEvgIitwIBAJYEACG5AgEAlgQAIboCAQCWBAAhuwIBAJYEACG8AgQAywQAIb4CAQCzBAAhvwJAAJcEACHAAkAA3AQAIQHsAgAAAL4CAgHsAkAAAAABEgkAAN4EACAPAADfBAAgiAIBAJYEACGKAgEAlgQAIZsCQACXBAAhpAJAAJcEACGoAgEAlgQAIakCAQCWBAAhrAIBALMEACGvAgAA2wS-AiK3AgEAlgQAIbkCAQCWBAAhugIBAJYEACG7AgEAlgQAIbwCBADLBAAhvgIBALMEACG_AkAAlwQAIcACQADcBAAhBSkAALIHACAqAAC4BwAg6QIAALMHACDqAgAAtwcAIO8CAAArACAFKQAAsAcAICoAALUHACDpAgAAsQcAIOoCAAC0BwAg7wIAAAEAIBIJAADhBAAgDwAA4gQAIIgCAQAAAAGKAgEAAAABmwJAAAAAAaQCQAAAAAGoAgEAAAABqQIBAAAAAawCAQAAAAGvAgAAAL4CArcCAQAAAAG5AgEAAAABugIBAAAAAbsCAQAAAAG8AgQAAAABvgIBAAAAAb8CQAAAAAHAAkAAAAABAykAALIHACDpAgAAswcAIO8CAAArACADKQAAsAcAIOkCAACxBwAg7wIAAAEAIAkIAADZBQAgCwAA2gUAIIgCAQAAAAGbAkAAAAABoAIBAAAAAaQCQAAAAAGvAgAAAMcCAsMCAQAAAAHJAgEAAAABAgAAAKYBACApAADjBAAgAwAAACAAICkAAOMEACAqAADnBAAgCwAAACAAIAgAAOkEACALAADqBAAgIgAA5wQAIIgCAQCWBAAhmwJAAJcEACGgAgEAlgQAIaQCQACXBAAhrwIAAOgExwIiwwIBAJYEACHJAgEAswQAIQkIAADpBAAgCwAA6gQAIIgCAQCWBAAhmwJAAJcEACGgAgEAlgQAIaQCQACXBAAhrwIAAOgExwIiwwIBAJYEACHJAgEAswQAIQHsAgAAAMcCAgspAAD6BAAwKgAA_wQAMOkCAAD7BAAw6gIAAPwEADDrAgAA_QQAIOwCAAD-BAAw7QIAAP4EADDuAgAA_gQAMO8CAAD-BAAw8AIAAIAFADDxAgAAgQUAMAspAADrBAAwKgAA8AQAMOkCAADsBAAw6gIAAO0EADDrAgAA7gQAIOwCAADvBAAw7QIAAO8EADDuAgAA7wQAMO8CAADvBAAw8AIAAPEEADDxAgAA8gQAMAQJAAD5BAAgigIBAAAAAZ0CAgAAAAG2AgAAALYCAgIAAAAZACApAAD4BAAgAwAAABkAICkAAPgEACAqAAD2BAAgASIAAK8HADALCQAA8QMAIAoAAIMEACCFAgAAgQQAMIYCAAAXABCHAgAAgQQAMIoCAQDuAwAhnQICAPcDACG0AgEA7gMAIbYCAACCBLYCIuECAAD_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_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_QQAIO8CAAD-BAAwBCkAAOsEADDpAgAA7AQAMOsCAADuBAAg7wIAAO8EADALCgAA4QUAIBQAANcFACCIAgEAAAABmwJAAAAAAaECAQAAAAGkAkAAAAABrwIAAADHAgK0AgEAAAABwgIBAAAAAcMCAQAAAAHIAkAAAAABAgAAABUAICkAANsFACADAAAAEwAgKQAA2wUAICoAAN8FACANAAAAEwAgCgAA4AUAIBQAAIUFACAiAADfBQAgiAIBAJYEACGbAkAAlwQAIaECAQCzBAAhpAJAAJcEACGvAgAA6ATHAiK0AgEAlgQAIcICAQCWBAAhwwIBAJYEACHIAkAA3AQAIQsKAADgBQAgFAAAhQUAIIgCAQCWBAAhmwJAAJcEACGhAgEAswQAIaQCQACXBAAhrwIAAOgExwIitAIBAJYEACHCAgEAlgQAIcMCAQCWBAAhyAJAANwEACEFKQAAigcAICoAAI0HACDpAgAAiwcAIOoCAACMBwAg7wIAAKYBACADKQAAigcAIOkCAACLBwAg7wIAAKYBACAQEQAA1QUAIBYAAOgFACAXAADRBQAgGAAA0gUAIBkAANMFACAaAADUBQAgiAIBAAAAAZsCQAAAAAGkAkAAAAABrQICAAAAAa8CAAAAxwICwQIBAAAAAcICAQAAAAHDAgEAAAABxAICAAAAAcUCAgAAAAECAAAAKwAgKQAA4gUAIAMAAAAdACApAADiBQAgKgAA5gUAIBIAAAAdACARAACXBQAgFgAA5wUAIBcAAJMFACAYAACUBQAgGQAAlQUAIBoAAJYFACAiAADmBQAgiAIBAJYEACGbAkAAlwQAIaQCQACXBAAhrQICAJgEACGvAgAA6ATHAiLBAgEAlgQAIcICAQCWBAAhwwIBAJYEACHEAgIAqwQAIcUCAgCrBAAhEBEAAJcFACAWAADnBQAgFwAAkwUAIBgAAJQFACAZAACVBQAgGgAAlgUAIIgCAQCWBAAhmwJAAJcEACGkAkAAlwQAIa0CAgCYBAAhrwIAAOgExwIiwQIBAJYEACHCAgEAlgQAIcMCAQCWBAAhxAICAKsEACHFAgIAqwQAIQUpAACFBwAgKgAAiAcAIOkCAACGBwAg6gIAAIcHACDvAgAAFQAgAykAAIUHACDpAgAAhgcAIO8CAAAVACADKQAA4gUAIOkCAADjBQAg7wIAACsAIAMpAADbBQAg6QIAANwFACDvAgAAFQAgAykAAOMEACDpAgAA5AQAIO8CAACmAQAgBCkAANEEADDpAgAA0gQAMOsCAADUBAAg7wIAANUEADAJEAAAigYAIBEAAPAFACAWAADuBQAgFwAAiQYAIBgAAO0GACAZAADqBgAgGgAA6wYAIK0CAACQBAAguAIAAJAEACAGCgAA7wUAIBQAAO4GACAVAACKBgAgoQIAAJAEACDHAgAAkAQAIMgCAACQBAAgBQgAAIgGACALAACJBgAgEwAAigYAIMkCAACQBAAgygIAAJAEACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABykAAIAHACAqAACDBwAg6QIAAIEHACDqAgAAggcAIO0CAAAbACDuAgAAGwAg7wIAAJ4CACADKQAAgAcAIOkCAACBBwAg7wIAAJ4CACAAAAYMAADtBQAgDQAA7gUAIA4AAO8FACARAADwBQAgrAIAAJAEACCtAgAAkAQAIAAAAAAAAAUpAAD7BgAgKgAA_gYAIOkCAAD8BgAg6gIAAP0GACDvAgAAAQAgAykAAPsGACDpAgAA_AYAIO8CAAABACAAAAAFKQAA9gYAICoAAPkGACDpAgAA9wYAIOoCAAD4BgAg7wIAAAEAIAMpAAD2BgAg6QIAAPcGACDvAgAAAQAgAAAAAewCAAAA3gICCykAANUGADAqAADaBgAw6QIAANYGADDqAgAA1wYAMOsCAADYBgAg7AIAANkGADDtAgAA2QYAMO4CAADZBgAw7wIAANkGADDwAgAA2wYAMPECAADcBgAwCykAAMkGADAqAADOBgAw6QIAAMoGADDqAgAAywYAMOsCAADMBgAg7AIAAM0GADDtAgAAzQYAMO4CAADNBgAw7wIAAM0GADDwAgAAzwYAMPECAADQBgAwCykAAL0GADAqAADCBgAw6QIAAL4GADDqAgAAvwYAMOsCAADABgAg7AIAAMEGADDtAgAAwQYAMO4CAADBBgAw7wIAAMEGADDwAgAAwwYAMPECAADEBgAwCykAALQGADAqAAC4BgAw6QIAALUGADDqAgAAtgYAMOsCAAC3BgAg7AIAALMFADDtAgAAswUAMO4CAACzBQAw7wIAALMFADDwAgAAuQYAMPECAAC2BQAwCykAAKsGADAqAACvBgAw6QIAAKwGADDqAgAArQYAMOsCAACuBgAg7AIAAKcFADDtAgAApwUAMO4CAACnBQAw7wIAAKcFADDwAgAAsAYAMPECAACqBQAwCykAAKIGADAqAACmBgAw6QIAAKMGADDqAgAApAYAMOsCAAClBgAg7AIAANUEADDtAgAA1QQAMO4CAADVBAAw7wIAANUEADDwAgAApwYAMPECAADYBAAwEgkAAOEEACAQAACiBQAgiAIBAAAAAYoCAQAAAAGbAkAAAAABpAJAAAAAAagCAQAAAAGpAgEAAAABrAIBAAAAAa8CAAAAvgICuAIBAAAAAbkCAQAAAAG6AgEAAAABuwIBAAAAAbwCBAAAAAG-AgEAAAABvwJAAAAAAcACQAAAAAECAAAAJAAgKQAAqgYAIAMAAAAkACApAACqBgAgKgAAqQYAIAEiAAD1BgAwAgAAACQAICIAAKkGACACAAAA2QQAICIAAKgGACAQiAIBAJYEACGKAgEAlgQAIZsCQACXBAAhpAJAAJcEACGoAgEAlgQAIakCAQCWBAAhrAIBALMEACGvAgAA2wS-AiK4AgEAswQAIbkCAQCWBAAhugIBAJYEACG7AgEAlgQAIbwCBADLBAAhvgIBALMEACG_AkAAlwQAIcACQADcBAAhEgkAAN4EACAQAACgBQAgiAIBAJYEACGKAgEAlgQAIZsCQACXBAAhpAJAAJcEACGoAgEAlgQAIakCAQCWBAAhrAIBALMEACGvAgAA2wS-AiK4AgEAswQAIbkCAQCWBAAhugIBAJYEACG7AgEAlgQAIbwCBADLBAAhvgIBALMEACG_AkAAlwQAIcACQADcBAAhEgkAAOEEACAQAACiBQAgiAIBAAAAAYoCAQAAAAGbAkAAAAABpAJAAAAAAagCAQAAAAGpAgEAAAABrAIBAAAAAa8CAAAAvgICuAIBAAAAAbkCAQAAAAG6AgEAAAABuwIBAAAAAbwCBAAAAAG-AgEAAAABvwJAAAAAAcACQAAAAAEHCQAAngQAIIgCAQAAAAGKAgEAAAABiwJAAAAAAYwCAgAAAAGNAiAAAAABjwIAAACPAgMCAAAAOAAgKQAAswYAIAMAAAA4ACApAACzBgAgKgAAsgYAIAEiAAD0BgAwAgAAADgAICIAALIGACACAAAAqwUAICIAALEGACAGiAIBAJYEACGKAgEAlgQAIYsCQACXBAAhjAICAJgEACGNAiAAmQQAIY8CAACaBI8CIwcJAACcBAAgiAIBAJYEACGKAgEAlgQAIYsCQACXBAAhjAICAJgEACGNAiAAmQQAIY8CAACaBI8CIwcJAACeBAAgiAIBAAAAAYoCAQAAAAGLAkAAAAABjAICAAAAAY0CIAAAAAGPAgAAAI8CAwMJAAClBAAgigIBAAAAAZsCQAAAAAECAAAANAAgKQAAvAYAIAMAAAA0ACApAAC8BgAgKgAAuwYAIAEiAADzBgAwAgAAADQAICIAALsGACACAAAAtwUAICIAALoGACACigIBAJYEACGbAkAAlwQAIQMJAACjBAAgigIBAJYEACGbAkAAlwQAIQMJAAClBAAgigIBAAAAAZsCQAAAAAEHFAAAxAQAIIgCAQAAAAGbAkAAAAABoAIBAAAAAaECAQAAAAGjAgAAAKMCAqQCQAAAAAECAAAADQAgKQAAyAYAIAMAAAANACApAADIBgAgKgAAxwYAIAEiAADyBgAwDQYAAPADACAUAAD5AwAghQIAAIsEADCGAgAACwAQhwIAAIsEADCIAgEAAAABmwJAAMADACGfAgEAuwMAIaACAQC7AwAhoQIBAL0DACGjAgAAjASjAiKkAkAAwAMAIeUCAACKBAAgAgAAAA0AICIAAMcGACACAAAAxQYAICIAAMYGACAKhQIAAMQGADCGAgAAxQYAEIcCAADEBgAwiAIBAO4DACGbAkAAwAMAIZ8CAQC7AwAhoAIBALsDACGhAgEAvQMAIaMCAACMBKMCIqQCQADAAwAhCoUCAADEBgAwhgIAAMUGABCHAgAAxAYAMIgCAQDuAwAhmwJAAMADACGfAgEAuwMAIaACAQC7AwAhoQIBAL0DACGjAgAAjASjAiKkAkAAwAMAIQaIAgEAlgQAIZsCQACXBAAhoAIBAJYEACGhAgEAswQAIaMCAAC0BKMCIqQCQACXBAAhBxQAALYEACCIAgEAlgQAIZsCQACXBAAhoAIBAJYEACGhAgEAswQAIaMCAAC0BKMCIqQCQACXBAAhBxQAAMQEACCIAgEAAAABmwJAAAAAAaACAQAAAAGhAgEAAAABowIAAACjAgKkAkAAAAABDYgCAQAAAAGbAkAAAAABpAJAAAAAAc0CAQAAAAHOAgEAAAABzwIBAAAAAdACAQAAAAHRAgEAAAAB0gIBAAAAAdMCQAAAAAHUAkAAAAAB1QIBAAAAAdYCAQAAAAECAAAACQAgKQAA1AYAIAMAAAAJACApAADUBgAgKgAA0wYAIAEiAADxBgAwEwMAAPADACCFAgAAjgQAMIYCAAAHABCHAgAAjgQAMIgCAQAAAAGJAgEAuwMAIZsCQADAAwAhpAJAAMADACHNAgEAuwMAIc4CAQC7AwAhzwIBALsDACHQAgEAvQMAIdECAQC9AwAh0gIBAL0DACHTAkAA_QMAIdQCQAD9AwAh1QIBAL0DACHWAgEAvQMAIeYCAACNBAAgAgAAAAkAICIAANMGACACAAAA0QYAICIAANIGACARhQIAANAGADCGAgAA0QYAEIcCAADQBgAwiAIBALsDACGJAgEAuwMAIZsCQADAAwAhpAJAAMADACHNAgEAuwMAIc4CAQC7AwAhzwIBALsDACHQAgEAvQMAIdECAQC9AwAh0gIBAL0DACHTAkAA_QMAIdQCQAD9AwAh1QIBAL0DACHWAgEAvQMAIRGFAgAA0AYAMIYCAADRBgAQhwIAANAGADCIAgEAuwMAIYkCAQC7AwAhmwJAAMADACGkAkAAwAMAIc0CAQC7AwAhzgIBALsDACHPAgEAuwMAIdACAQC9AwAh0QIBAL0DACHSAgEAvQMAIdMCQAD9AwAh1AJAAP0DACHVAgEAvQMAIdYCAQC9AwAhDYgCAQCWBAAhmwJAAJcEACGkAkAAlwQAIc0CAQCWBAAhzgIBAJYEACHPAgEAlgQAIdACAQCzBAAh0QIBALMEACHSAgEAswQAIdMCQADcBAAh1AJAANwEACHVAgEAswQAIdYCAQCzBAAhDYgCAQCWBAAhmwJAAJcEACGkAkAAlwQAIc0CAQCWBAAhzgIBAJYEACHPAgEAlgQAIdACAQCzBAAh0QIBALMEACHSAgEAswQAIdMCQADcBAAh1AJAANwEACHVAgEAswQAIdYCAQCzBAAhDYgCAQAAAAGbAkAAAAABpAJAAAAAAc0CAQAAAAHOAgEAAAABzwIBAAAAAdACAQAAAAHRAgEAAAAB0gIBAAAAAdMCQAAAAAHUAkAAAAAB1QIBAAAAAdYCAQAAAAEHiAIBAAAAAZsCQAAAAAGkAkAAAAABvwJAAAAAAdcCAQAAAAHYAgEAAAAB2QIBAAAAAQIAAAAFACApAADgBgAgAwAAAAUAICkAAOAGACAqAADfBgAgASIAAPAGADAMAwAA8AMAIIUCAACPBAAwhgIAAAMAEIcCAACPBAAwiAIBAAAAAYkCAQC7AwAhmwJAAMADACGkAkAAwAMAIb8CQADAAwAh1wIBAAAAAdgCAQC9AwAh2QIBAL0DACECAAAABQAgIgAA3wYAIAIAAADdBgAgIgAA3gYAIAuFAgAA3AYAMIYCAADdBgAQhwIAANwGADCIAgEAuwMAIYkCAQC7AwAhmwJAAMADACGkAkAAwAMAIb8CQADAAwAh1wIBALsDACHYAgEAvQMAIdkCAQC9AwAhC4UCAADcBgAwhgIAAN0GABCHAgAA3AYAMIgCAQC7AwAhiQIBALsDACGbAkAAwAMAIaQCQADAAwAhvwJAAMADACHXAgEAuwMAIdgCAQC9AwAh2QIBAL0DACEHiAIBAJYEACGbAkAAlwQAIaQCQACXBAAhvwJAAJcEACHXAgEAlgQAIdgCAQCzBAAh2QIBALMEACEHiAIBAJYEACGbAkAAlwQAIaQCQACXBAAhvwJAAJcEACHXAgEAlgQAIdgCAQCzBAAh2QIBALMEACEHiAIBAAAAAZsCQAAAAAGkAkAAAAABvwJAAAAAAdcCAQAAAAHYAgEAAAAB2QIBAAAAAQQpAADVBgAw6QIAANYGADDrAgAA2AYAIO8CAADZBgAwBCkAAMkGADDpAgAAygYAMOsCAADMBgAg7wIAAM0GADAEKQAAvQYAMOkCAAC-BgAw6wIAAMAGACDvAgAAwQYAMAQpAAC0BgAw6QIAALUGADDrAgAAtwYAIO8CAACzBQAwBCkAAKsGADDpAgAArAYAMOsCAACuBgAg7wIAAKcFADAEKQAAogYAMOkCAACjBgAw6wIAAKUGACDvAgAA1QQAMAAAAAAABwQAAOcGACAFAADoBgAgEQAA8AUAIBoAAOsGACAbAADpBgAgHAAA6gYAINwCAACQBAAgAAADBgAA7AYAIBQAAO0GACChAgAAkAQAIAeIAgEAAAABmwJAAAAAAaQCQAAAAAG_AkAAAAAB1wIBAAAAAdgCAQAAAAHZAgEAAAABDYgCAQAAAAGbAkAAAAABpAJAAAAAAc0CAQAAAAHOAgEAAAABzwIBAAAAAdACAQAAAAHRAgEAAAAB0gIBAAAAAdMCQAAAAAHUAkAAAAAB1QIBAAAAAdYCAQAAAAEGiAIBAAAAAZsCQAAAAAGgAgEAAAABoQIBAAAAAaMCAAAAowICpAJAAAAAAQKKAgEAAAABmwJAAAAAAQaIAgEAAAABigIBAAAAAYsCQAAAAAGMAgIAAAABjQIgAAAAAY8CAAAAjwIDEIgCAQAAAAGKAgEAAAABmwJAAAAAAaQCQAAAAAGoAgEAAAABqQIBAAAAAawCAQAAAAGvAgAAAL4CArgCAQAAAAG5AgEAAAABugIBAAAAAbsCAQAAAAG8AgQAAAABvgIBAAAAAb8CQAAAAAHAAkAAAAABDQUAAOIGACARAADmBgAgGgAA5QYAIBsAAOMGACAcAADkBgAgiAIBAAAAAZsCQAAAAAGgAgEAAAABpAJAAAAAAdoCAQAAAAHbAiAAAAAB3AIBAAAAAd4CAAAA3gICAgAAAAEAICkAAPYGACADAAAASwAgKQAA9gYAICoAAPoGACAPAAAASwAgBQAAnQYAIBEAAKEGACAaAACgBgAgGwAAngYAIBwAAJ8GACAiAAD6BgAgiAIBAJYEACGbAkAAlwQAIaACAQCWBAAhpAJAAJcEACHaAgEAlgQAIdsCIACZBAAh3AIBALMEACHeAgAAmwbeAiINBQAAnQYAIBEAAKEGACAaAACgBgAgGwAAngYAIBwAAJ8GACCIAgEAlgQAIZsCQACXBAAhoAIBAJYEACGkAkAAlwQAIdoCAQCWBAAh2wIgAJkEACHcAgEAswQAId4CAACbBt4CIg0EAADhBgAgEQAA5gYAIBoAAOUGACAbAADjBgAgHAAA5AYAIIgCAQAAAAGbAkAAAAABoAIBAAAAAaQCQAAAAAHaAgEAAAAB2wIgAAAAAdwCAQAAAAHeAgAAAN4CAgIAAAABACApAAD7BgAgAwAAAEsAICkAAPsGACAqAAD_BgAgDwAAAEsAIAQAAJwGACARAAChBgAgGgAAoAYAIBsAAJ4GACAcAACfBgAgIgAA_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-LwCBATAAggGRAQB_kgEAgAEAAAAAAAUSAH4vAIEBMACCAZEBAH-SAQCAAR0CAR5KAR9NASBOASFPASNRASRTFCVUFSZWASdYFChZFitaASxbAS1cFDFfFzJgGzNhAjRiAjVjAjZkAjdlAjhnAjlpFDpqHDtsAjxuFD1vHT5wAj9xAkByFEF1HkJ2IkN3A0R4A0V5A0Z6A0d7A0h9A0l_FEqAASNLggEDTIQBFE2FASROhgEDT4cBA1CIARRRiwElUowBKVOOASpUjwEqVZIBKlaTASpXlAEqWJYBKlmYARRamQErW5sBKlydARRdngEsXp8BKl-gASpgoQEUYaQBLWKlATFjpwEIZKgBCGWqAQhmqwEIZ6wBCGiuAQhpsAEUarEBMmu0AQhstgEUbbcBM265AQhvugEIcLsBFHG-ATRyvwE4c8ABB3TBAQd1wgEHdsMBB3fEAQd4xgEHecgBFHrJATl7zAEHfM4BFH3PATp-0QEHf9IBB4AB0wEUgQHWATuCAdcBP4MB2AEGhAHZAQaFAdoBBoYB2wEGhwHcAQaIAd4BBokB4AEUigHhAUCLAeQBBowB5gEUjQHnAUGOAekBBo8B6gEGkAHrARSTAe4BQpQB7wFIlQHwAQuWAfEBC5cB8gELmAHzAQuZAfQBC5oB9gELmwH4ARScAfkBSZ0B_AELngH-ARSfAf8BSqABgQILoQGCAguiAYMCFKMBhgJLpAGHAlGlAYgCCaYBiQIJpwGKAgmoAYsCCakBjAIJqgGOAgmrAZACFKwBkQJSrQGTAgmuAZUCFK8BlgJTsAGXAgmxAZgCCbIBmQIUswGcAlS0AZ0CWrUBnwIKtgGgAgq3AaICCrgBowIKuQGkAgq6AaYCCrsBqAIUvAGpAlu9AasCCr4BrQIUvwGuAlzAAa8CCsEBsAIKwgGxAhTDAbQCXcQBtQJjxQG2AgTGAbcCBMcBuAIEyAG5AgTJAboCBMoBvAIEywG-AhTMAb8CZM0BwQIEzgHDAhTPAcQCZdABxQIE0QHGAgTSAccCFNMBygJm1AHLAmrVAcwCBdYBzQIF1wHOAgXYAc8CBdkB0AIF2gHSAgXbAdQCFNwB1QJr3QHXAgXeAdkCFN8B2gJs4AHbAgXhAdwCBeIB3QIU4wHgAm3kAeECc-UB4gIP5gHjAg_nAeQCD-gB5QIP6QHmAg_qAegCD-sB6gIU7AHrAnTtAe0CD-4B7wIU7wHwAnXwAfECD_EB8gIP8gHzAhTzAfYCdvQB9wJ69QH4AhD2AfkCEPcB-gIQ-AH7AhD5AfwCEPoB_gIQ-wGAAxT8AYEDe_0BgwMQ_gGFAxT_AYYDfIAChwMQgQKIAxCCAokDFIMCjAN9hAKNA4MB"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer } = await import("buffer");
  const wasmArray = Buffer.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// src/generated/prisma/internal/prismaNamespace.ts
import * as runtime2 from "@prisma/client/runtime/client";
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var defineExtension = runtime2.Extensions.defineExtension;

// src/generated/prisma/enums.ts
var PublicationStatus = {
  DRAFT: "DRAFT",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED"
};
var MediaKind = {
  AUDIO: "AUDIO",
  IMAGE: "IMAGE"
};
var MediaStatus = {
  PENDING: "PENDING",
  READY: "READY",
  FAILED: "FAILED",
  DELETED: "DELETED"
};
var UploadStatus = {
  INITIATED: "INITIATED",
  UPLOADING: "UPLOADING",
  UPLOADED: "UPLOADED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED"
};
var PlaylistVisibility = {
  PRIVATE: "PRIVATE",
  PUBLIC: "PUBLIC",
  UNLISTED: "UNLISTED"
};

// src/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/lib/prisma.ts
var adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
var prisma = new PrismaClient({ adapter });

// src/auth.ts
var auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.CLIENT_ORIGIN],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true
  },
  user: {
    additionalFields: {
      role: {
        type: ["USER", "ADMIN"],
        required: false,
        defaultValue: "USER",
        input: false,
        returned: true
      }
    }
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production"
  }
});

// src/routes/auth.ts
import { Router } from "express";

// src/middleware/auth.ts
import { fromNodeHeaders } from "better-auth/node";
async function requireAuth(request, response, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers)
    });
    if (!session) {
      response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } });
      return;
    }
    response.locals.auth = session;
    next();
  } catch (error) {
    console.error("Authentication lookup failed", {
      error: error instanceof Error ? error.name : "UnknownError"
    });
    response.status(503).json({
      error: { code: "AUTHENTICATION_UNAVAILABLE", message: "Authentication service unavailable" }
    });
  }
}
function requireAdmin(request, response, next) {
  if (response.locals.auth?.user.role !== "ADMIN") {
    response.status(403).json({ error: { code: "FORBIDDEN", message: "Administrator access required" } });
    return;
  }
  next();
}

// src/routes/auth.ts
var authRouter = Router();
authRouter.get("/me", requireAuth, (_request, response) => {
  const user = response.locals.auth?.user;
  response.status(200).json({
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    } : null
  });
});
authRouter.get("/admin-check", requireAuth, requireAdmin, (_request, response) => {
  response.status(200).json({ authorized: true });
});

// src/middleware/rate-limit.ts
var WINDOW_MS = 6e4;
var MAX_ATTEMPTS = 10;
var attempts = /* @__PURE__ */ new Map();
var uploadAttempts = /* @__PURE__ */ new Map();
var protectedOperations = /* @__PURE__ */ new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/forget-password",
  "/reset-password"
]);
function clientKey(request) {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}
function authRateLimit(request, response, next) {
  if (!protectedOperations.has(request.path)) {
    next();
    return;
  }
  const key = clientKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + WINDOW_MS } : { count: current.count + 1, resetAt: current.resetAt };
  attempts.set(key, entry);
  if (entry.count > MAX_ATTEMPTS) {
    response.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1e3));
    response.status(429).json({
      error: { code: "AUTH_RATE_LIMITED", message: "Too many authentication attempts" }
    });
    return;
  }
  next();
}
function uploadRateLimit(request, response, next) {
  const key = clientKey(request);
  const now = Date.now();
  const current = uploadAttempts.get(key);
  const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + WINDOW_MS } : { count: current.count + 1, resetAt: current.resetAt };
  uploadAttempts.set(key, entry);
  if (entry.count > 30) {
    response.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1e3));
    response.status(429).json({ error: { code: "UPLOAD_RATE_LIMITED", message: "Too many upload requests" } });
    return;
  }
  next();
}

// src/routes/catalog.ts
import { Router as Router2 } from "express";

// src/services/catalog.ts
var published = { status: PublicationStatus.PUBLISHED };
async function listArtists(page2, limit) {
  const skip = (page2 - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.artist.findMany({
      where: published,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        bio: true,
        albums: {
          where: published,
          orderBy: { releaseDate: "desc" },
          select: { id: true, title: true, slug: true, releaseDate: true }
        }
      }
    }),
    prisma.artist.count({ where: published })
  ]);
  return { items, total };
}
function getArtist(slug2) {
  return prisma.artist.findFirst({
    where: { slug: slug2, ...published },
    select: {
      id: true,
      name: true,
      slug: true,
      bio: true,
      albums: {
        where: published,
        orderBy: { releaseDate: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          releaseDate: true
        }
      }
    }
  });
}
function getAlbum(slug2) {
  return prisma.album.findFirst({
    where: { slug: slug2, ...published, artist: published },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      releaseDate: true,
      artist: { select: { id: true, name: true, slug: true } },
      tracks: {
        where: published,
        orderBy: [{ discNumber: "asc" }, { trackNumber: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          trackNumber: true,
          discNumber: true,
          durationSeconds: true
        }
      }
    }
  });
}
function getTrack(id2) {
  return prisma.track.findFirst({
    where: { id: id2, ...published, album: { ...published, artist: published } },
    select: {
      id: true,
      title: true,
      slug: true,
      trackNumber: true,
      discNumber: true,
      durationSeconds: true,
      album: {
        select: {
          id: true,
          title: true,
          slug: true,
          artist: { select: { id: true, name: true, slug: true } }
        }
      },
      artists: {
        where: { artist: published },
        orderBy: { position: "asc" },
        select: {
          creditType: true,
          position: true,
          artist: { select: { id: true, name: true, slug: true } }
        }
      }
    }
  });
}

// src/validation/catalog.ts
import { z as z2 } from "zod";
var artistSlugSchema = z2.object({ slug: z2.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
var albumSlugSchema = artistSlugSchema;
var trackIdSchema = z2.object({ id: z2.uuid() });
var paginationSchema = z2.object({
  page: z2.coerce.number().int().min(1).default(1),
  limit: z2.coerce.number().int().min(1).max(100).default(20)
});

// src/routes/catalog.ts
var catalogRouter = Router2();
function validationError(response, message = "Invalid request parameters") {
  response.status(400).json({ error: { code: "INVALID_REQUEST", message } });
}
function notFound(response) {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Catalog resource not found" } });
}
catalogRouter.get("/artists", async (request, response, next) => {
  const parsed = paginationSchema.safeParse(request.query);
  if (!parsed.success) return validationError(response);
  try {
    const { items, total } = await listArtists(parsed.data.page, parsed.data.limit);
    response.json({ data: items, pagination: { page: parsed.data.page, limit: parsed.data.limit, total, totalPages: Math.ceil(total / parsed.data.limit) } });
  } catch (error) {
    next(error);
  }
});
catalogRouter.get("/artists/:slug", async (request, response, next) => {
  const parsed = artistSlugSchema.safeParse(request.params);
  if (!parsed.success) return validationError(response);
  try {
    const item = await getArtist(parsed.data.slug);
    if (!item) return notFound(response);
    response.json({ data: item });
  } catch (error) {
    next(error);
  }
});
catalogRouter.get("/albums/:slug", async (request, response, next) => {
  const parsed = albumSlugSchema.safeParse(request.params);
  if (!parsed.success) return validationError(response);
  try {
    const item = await getAlbum(parsed.data.slug);
    if (!item) return notFound(response);
    response.json({ data: item });
  } catch (error) {
    next(error);
  }
});
catalogRouter.get("/tracks/:id", async (request, response, next) => {
  const parsed = trackIdSchema.safeParse(request.params);
  if (!parsed.success) return validationError(response);
  try {
    const item = await getTrack(parsed.data.id);
    if (!item) return notFound(response);
    response.json({ data: item });
  } catch (error) {
    next(error);
  }
});

// src/routes/admin-catalog.ts
import { Router as Router3 } from "express";

// src/validation/admin-catalog.ts
import { z as z3 } from "zod";
var id = z3.uuid();
var slug = z3.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
var optionalDate = z3.coerce.date().nullable().optional();
var adminIdSchema = z3.object({ id });
var createArtistSchema = z3.object({ name: z3.string().trim().min(1).max(200), slug, bio: z3.string().trim().max(5e3).nullable().optional() }).strict();
var updateArtistSchema = createArtistSchema.partial();
var createAlbumSchema = z3.object({ artistId: id, title: z3.string().trim().min(1).max(200), slug, description: z3.string().trim().max(5e3).nullable().optional(), releaseDate: optionalDate }).strict();
var updateAlbumSchema = createAlbumSchema.partial().omit({ artistId: true });
var trackArtistSchema = z3.object({ artistId: id, creditType: z3.enum(["PRIMARY", "FEATURED"]).default("PRIMARY"), position: z3.number().int().min(0).max(1e3) }).strict();
var createTrackSchema = z3.object({ albumId: id, title: z3.string().trim().min(1).max(200), slug, trackNumber: z3.number().int().min(1).max(1e4), discNumber: z3.number().int().min(1).max(1e3).default(1), durationSeconds: z3.number().int().positive().nullable().optional(), artists: z3.array(trackArtistSchema).max(100).default([]) }).strict();
var updateTrackSchema = createTrackSchema.partial().omit({ albumId: true });

// src/services/admin-catalog.ts
var artistSelect = {
  id: true,
  name: true,
  slug: true,
  bio: true,
  status: true
};
var albumSelect = {
  id: true,
  artistId: true,
  title: true,
  slug: true,
  description: true,
  releaseDate: true,
  status: true
};
var trackSelect = {
  id: true,
  albumId: true,
  title: true,
  slug: true,
  trackNumber: true,
  discNumber: true,
  durationSeconds: true,
  status: true
};
var createArtist = (input) => prisma.artist.create({
  data: { ...input, status: PublicationStatus.DRAFT },
  select: artistSelect
});
var updateArtist = (id2, input) => prisma.artist.update({
  where: { id: id2 },
  data: { ...input },
  select: artistSelect
});
var createAlbum = (input) => prisma.album.create({
  data: { ...input, status: PublicationStatus.DRAFT },
  select: albumSelect
});
var updateAlbum = (id2, input) => prisma.album.update({
  where: { id: id2 },
  data: { ...input },
  select: albumSelect
});
async function createTrack(input) {
  return prisma.$transaction(async (transaction) => {
    const track2 = await transaction.track.create({
      data: {
        albumId: input.albumId,
        title: input.title,
        slug: input.slug,
        trackNumber: input.trackNumber,
        discNumber: input.discNumber,
        durationSeconds: input.durationSeconds,
        status: PublicationStatus.DRAFT
      },
      select: trackSelect
    });
    if (input.artists.length)
      await transaction.trackArtist.createMany({
        data: input.artists.map((artist) => ({ ...artist, trackId: track2.id }))
      });
    return track2;
  });
}
async function updateTrack(id2, input) {
  return prisma.$transaction(async (transaction) => {
    const track2 = await transaction.track.update({
      where: { id: id2 },
      data: {
        title: input.title,
        slug: input.slug,
        trackNumber: input.trackNumber,
        discNumber: input.discNumber,
        durationSeconds: input.durationSeconds
      },
      select: trackSelect
    });
    if (input.artists) {
      await transaction.trackArtist.deleteMany({ where: { trackId: id2 } });
      if (input.artists.length)
        await transaction.trackArtist.createMany({
          data: input.artists.map((artist) => ({ ...artist, trackId: id2 }))
        });
    }
    return track2;
  });
}
async function changePublication(resource, id2, status) {
  if (status === PublicationStatus.PUBLISHED) {
    if (resource === "album") {
      const album = await prisma.album.findUnique({
        where: { id: id2 },
        select: { artist: { select: { status: true } } }
      });
      if (!album) return null;
      if (album.artist.status !== PublicationStatus.PUBLISHED)
        throw new Error("PARENT_NOT_PUBLISHED");
    }
    if (resource === "track") {
      const track2 = await prisma.track.findUnique({
        where: { id: id2 },
        select: {
          album: { select: { status: true } },
          artists: {
            where: { creditType: "PRIMARY" },
            select: { artist: { select: { status: true } } }
          }
        }
      });
      if (!track2) return null;
      if (track2.album.status !== PublicationStatus.PUBLISHED)
        throw new Error("PARENT_NOT_PUBLISHED");
      const media = await prisma.mediaAsset.findUnique({
        where: {
          id: (await prisma.track.findUniqueOrThrow({
            where: { id: id2 },
            select: { mediaAssetId: true }
          })).mediaAssetId ?? ""
        },
        select: { kind: true, status: true }
      }).catch(() => null);
      if (!media || media.kind !== "AUDIO" || media.status !== "READY")
        throw new Error("MEDIA_REQUIRED");
      if (track2.artists.length !== 1 || track2.artists[0].artist.status !== PublicationStatus.PUBLISHED)
        throw new Error("PRIMARY_ARTIST_REQUIRED");
    }
  }
  if (resource === "artist")
    return prisma.artist.update({
      where: { id: id2 },
      data: { status },
      select: artistSelect
    });
  if (resource === "album")
    return prisma.album.update({
      where: { id: id2 },
      data: { status },
      select: albumSelect
    });
  return prisma.track.update({
    where: { id: id2 },
    data: { status },
    select: trackSelect
  });
}
function isConflict(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
function isMissing(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

// src/routes/admin-catalog.ts
var adminCatalogRouter = Router3();
adminCatalogRouter.use(requireAuth, requireAdmin);
function invalid(response) {
  response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } });
}
function notFound2(response) {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Catalog resource not found" } });
}
function conflict(response, message = "Catalog resource conflicts with an existing record") {
  response.status(409).json({ error: { code: "CONFLICT", message } });
}
function dependency(response, message) {
  response.status(409).json({ error: { code: "PUBLICATION_DEPENDENCY", message } });
}
function handle(error, response, next) {
  if (isConflict(error)) return conflict(response, "A resource with that slug or position already exists");
  if (isMissing(error)) return notFound2(response);
  next(error);
}
adminCatalogRouter.post("/artists", async (request, response, next) => {
  const parsed = createArtistSchema.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  try {
    response.status(201).json({ data: await createArtist(parsed.data) });
  } catch (error) {
    handle(error, response, next);
  }
});
adminCatalogRouter.patch("/artists/:id", async (request, response, next) => {
  const params = adminIdSchema.safeParse(request.params);
  const body = updateArtistSchema.safeParse(request.body);
  if (!params.success || !body.success) return invalid(response);
  try {
    response.json({ data: await updateArtist(params.data.id, body.data) });
  } catch (error) {
    handle(error, response, next);
  }
});
adminCatalogRouter.post("/artists/:id/publish", async (request, response, next) => change(request, response, next, "artist", PublicationStatus.PUBLISHED));
adminCatalogRouter.post("/artists/:id/archive", async (request, response, next) => change(request, response, next, "artist", PublicationStatus.ARCHIVED));
adminCatalogRouter.post("/albums", async (request, response, next) => {
  const parsed = createAlbumSchema.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  try {
    response.status(201).json({ data: await createAlbum(parsed.data) });
  } catch (error) {
    handle(error, response, next);
  }
});
adminCatalogRouter.patch("/albums/:id", async (request, response, next) => {
  const params = adminIdSchema.safeParse(request.params);
  const body = updateAlbumSchema.safeParse(request.body);
  if (!params.success || !body.success) return invalid(response);
  try {
    response.json({ data: await updateAlbum(params.data.id, body.data) });
  } catch (error) {
    handle(error, response, next);
  }
});
adminCatalogRouter.post("/albums/:id/publish", async (request, response, next) => change(request, response, next, "album", PublicationStatus.PUBLISHED));
adminCatalogRouter.post("/albums/:id/archive", async (request, response, next) => change(request, response, next, "album", PublicationStatus.ARCHIVED));
adminCatalogRouter.post("/tracks", async (request, response, next) => {
  const parsed = createTrackSchema.safeParse(request.body);
  if (!parsed.success) return invalid(response);
  try {
    response.status(201).json({ data: await createTrack(parsed.data) });
  } catch (error) {
    handle(error, response, next);
  }
});
adminCatalogRouter.patch("/tracks/:id", async (request, response, next) => {
  const params = adminIdSchema.safeParse(request.params);
  const body = updateTrackSchema.safeParse(request.body);
  if (!params.success || !body.success) return invalid(response);
  try {
    response.json({ data: await updateTrack(params.data.id, body.data) });
  } catch (error) {
    handle(error, response, next);
  }
});
adminCatalogRouter.post("/tracks/:id/publish", async (request, response, next) => change(request, response, next, "track", PublicationStatus.PUBLISHED));
adminCatalogRouter.post("/tracks/:id/archive", async (request, response, next) => change(request, response, next, "track", PublicationStatus.ARCHIVED));
async function change(request, response, next, resource, status) {
  const params = adminIdSchema.safeParse(request.params);
  if (!params.success) return invalid(response);
  try {
    const result = await changePublication(resource, params.data.id, status);
    if (!result) return notFound2(response);
    response.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "PARENT_NOT_PUBLISHED") return dependency(response, "The parent resource must be published first");
    if (error instanceof Error && error.message === "PRIMARY_ARTIST_REQUIRED") return dependency(response, "A published primary artist is required before publishing a track");
    if (error instanceof Error && error.message === "MEDIA_REQUIRED") return dependency(response, "A ready audio asset is required before publishing a track");
    handle(error, response, next);
  }
}

// src/routes/media.ts
import { Router as Router4 } from "express";

// src/validation/uploads.ts
import { z as z4 } from "zod";
var mime = z4.enum(["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac"]);
var filename = z4.string().min(1).max(255).refine((v) => !/[\\/]/.test(v) && [...v].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127), "Invalid filename");
var uploadTrackParams = z4.object({ id: z4.uuid() });
var uploadIdParams = z4.object({ id: z4.uuid() });
var initiateUpload = z4.object({ filename, contentType: mime, byteSize: z4.number().int().min(1).max(env.MAX_AUDIO_UPLOAD_BYTES), checksum: z4.string().regex(/^[A-Za-z0-9+/=_-]+$/).max(256).optional() }).strict();

// src/services/uploads.ts
async function initiate(trackId2, userId, input, store) {
  const track2 = await prisma.track.findUnique({
    where: { id: trackId2 },
    select: { id: true }
  });
  if (!track2) return null;
  const uploadId = crypto.randomUUID();
  const key = `tracks/${trackId2}/uploads/${uploadId}/audio`;
  const expiresAt = new Date(Date.now() + env.UPLOAD_URL_TTL_SECONDS * 1e3);
  const upload = await prisma.upload.create({
    data: {
      id: uploadId,
      trackId: trackId2,
      initiatedByUserId: userId,
      provider: env.OBJECT_STORAGE_PROVIDER,
      bucket: env.OBJECT_STORAGE_BUCKET,
      objectKey: key,
      originalFilename: input.filename,
      expectedMimeType: input.contentType,
      expectedByteSize: input.byteSize,
      checksum: input.checksum,
      expiresAt
    }
  });
  return {
    upload,
    url: await store.createUploadUrl(
      key,
      input.contentType,
      env.UPLOAD_URL_TTL_SECONDS
    )
  };
}
async function complete(id2, userId, store) {
  const upload = await prisma.upload.findFirst({
    where: { id: id2, initiatedByUserId: userId }
  });
  if (!upload) return { kind: "missing" };
  if (upload.status === UploadStatus.COMPLETED)
    return { kind: "done", assetId: upload.mediaAssetId };
  if (upload.expiresAt <= /* @__PURE__ */ new Date()) {
    await prisma.upload.update({
      where: { id: id2 },
      data: { status: UploadStatus.EXPIRED, failureCode: "EXPIRED" }
    });
    return { kind: "failed" };
  }
  const head = await store.headObject(upload.objectKey);
  console.info("Upload completion verification", {
    uploadId: upload.id,
    trackId: upload.trackId,
    objectKey: upload.objectKey,
    expectedByteSize: Number(upload.expectedByteSize),
    actualByteSize: head?.contentLength,
    expectedMimeType: upload.expectedMimeType,
    actualMimeType: head?.contentType,
    objectFound: Boolean(head)
  });
  if (!head || head.contentLength !== Number(upload.expectedByteSize) || head.contentType && head.contentType !== upload.expectedMimeType) {
    await prisma.upload.update({
      where: { id: id2 },
      data: {
        status: UploadStatus.FAILED,
        failureCode: "OBJECT_VERIFICATION_FAILED"
      }
    });
    return { kind: "failed" };
  }
  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.mediaAsset.create({
      data: {
        kind: MediaKind.AUDIO,
        storageProvider: upload.provider,
        bucket: upload.bucket,
        objectKey: upload.objectKey,
        mimeType: upload.expectedMimeType,
        byteSize: upload.expectedByteSize,
        checksum: upload.checksum ?? head.checksum,
        status: MediaStatus.READY
      }
    });
    await tx.upload.update({
      where: { id: id2 },
      data: {
        status: UploadStatus.COMPLETED,
        mediaAssetId: created.id,
        completedAt: /* @__PURE__ */ new Date()
      }
    });
    await tx.track.update({
      where: { id: upload.trackId },
      data: { mediaAssetId: created.id }
    });
    return created;
  });
  return { kind: "done", assetId: asset.id };
}
async function retry(id2, userId, input, store) {
  const old = await prisma.upload.findFirst({
    where: { id: id2, initiatedByUserId: userId }
  });
  if (!old || old.status !== UploadStatus.FAILED && old.status !== UploadStatus.EXPIRED)
    return null;
  return initiate(old.trackId, userId, input, store);
}

// src/services/playback.ts
async function playback(id2, store) {
  const track2 = await prisma.track.findFirst({
    where: {
      id: id2,
      status: PublicationStatus.PUBLISHED,
      album: {
        status: PublicationStatus.PUBLISHED,
        artist: { status: PublicationStatus.PUBLISHED }
      },
      mediaAsset: { kind: MediaKind.AUDIO, status: MediaStatus.READY }
    },
    select: { mediaAsset: { select: { objectKey: true } } }
  });
  if (!track2?.mediaAsset) return null;
  return {
    url: await store.createDownloadUrl(
      track2.mediaAsset.objectKey,
      env.PLAYBACK_URL_TTL_SECONDS
    ),
    expiresAt: new Date(
      Date.now() + env.PLAYBACK_URL_TTL_SECONDS * 1e3
    ).toISOString()
  };
}

// src/storage/s3-storage.ts
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var client = new S3Client({ region: env.OBJECT_STORAGE_REGION, endpoint: env.OBJECT_STORAGE_ENDPOINT, credentials: env.OBJECT_STORAGE_ACCESS_KEY_ID && env.OBJECT_STORAGE_SECRET_ACCESS_KEY ? { accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID, secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY } : void 0 });
var storage = {
  async createUploadUrl(key, contentType, expiresIn) {
    return getSignedUrl(client, new PutObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key, ContentType: contentType }), { expiresIn });
  },
  async headObject(key) {
    try {
      const r = await client.send(new HeadObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key }));
      return { contentLength: r.ContentLength, contentType: r.ContentType, checksum: r.ChecksumSHA256 ?? r.ETag };
    } catch (error) {
      console.error("Object storage HeadObject failed", { error: error instanceof Error ? error.name : "UnknownError", code: typeof error === "object" && error !== null && "$metadata" in error ? error.name : void 0, bucket: env.OBJECT_STORAGE_BUCKET, key });
      return null;
    }
  },
  async createDownloadUrl(key, expiresIn) {
    return getSignedUrl(client, new GetObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key }), { expiresIn });
  },
  async deleteObject(key) {
    await client.send(new DeleteObjectCommand({ Bucket: env.OBJECT_STORAGE_BUCKET, Key: key }));
  }
};

// src/routes/media.ts
var mediaRouter = Router4();
var admin = [requireAuth, requireAdmin];
var bad = (r) => r.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } });
var nf = (r) => r.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
var fail = (r) => r.status(409).json({ error: { code: "UPLOAD_FAILED", message: "Upload verification failed" } });
mediaRouter.post("/admin/tracks/:id/audio/upload", ...admin, async (req, res, next) => {
  const p = uploadTrackParams.safeParse(req.params), b = initiateUpload.safeParse(req.body);
  if (!p.success || !b.success) return bad(res);
  try {
    const x = await initiate(p.data.id, res.locals.auth.user.id, b.data, storage);
    if (!x) return nf(res);
    res.status(201).json({ data: { uploadId: x.upload.id, uploadUrl: x.url, expiresAt: x.upload.expiresAt.toISOString(), requiredHeaders: { "content-type": x.upload.expectedMimeType } } });
  } catch (e) {
    next(e);
  }
});
mediaRouter.post("/admin/uploads/:id/complete", ...admin, async (req, res, next) => {
  const p = uploadIdParams.safeParse(req.params);
  if (!p.success) return bad(res);
  try {
    const x = await complete(p.data.id, res.locals.auth.user.id, storage);
    if (x.kind === "missing") return nf(res);
    if (x.kind === "failed") return fail(res);
    res.json({ data: { uploadId: p.data.id, mediaAssetId: x.assetId, status: "COMPLETED" } });
  } catch (e) {
    next(e);
  }
});
mediaRouter.post("/admin/uploads/:id/retry", ...admin, async (req, res, next) => {
  const p = uploadIdParams.safeParse(req.params), b = initiateUpload.safeParse(req.body);
  if (!p.success || !b.success) return bad(res);
  try {
    const x = await retry(p.data.id, res.locals.auth.user.id, b.data, storage);
    if (!x) return nf(res);
    res.status(201).json({ data: { uploadId: x.upload.id, uploadUrl: x.url, expiresAt: x.upload.expiresAt.toISOString(), requiredHeaders: { "content-type": x.upload.expectedMimeType } } });
  } catch (e) {
    next(e);
  }
});
mediaRouter.get("/tracks/:id/playback", async (req, res, next) => {
  const p = uploadTrackParams.safeParse(req.params);
  if (!p.success) return bad(res);
  try {
    const x = await playback(p.data.id, storage);
    if (!x) return nf(res);
    res.json({ data: x });
  } catch (e) {
    next(e);
  }
});

// src/routes/playlists.ts
import { Router as Router5 } from "express";

// src/services/playlists.ts
var trackSelect2 = {
  id: true,
  title: true,
  slug: true,
  trackNumber: true,
  discNumber: true,
  durationSeconds: true,
  artists: {
    where: { artist: { status: PublicationStatus.PUBLISHED } },
    select: {
      creditType: true,
      position: true,
      artist: { select: { id: true, name: true, slug: true } }
    },
    orderBy: { position: "asc" }
  }
};
var playlistSelect = {
  id: true,
  name: true,
  description: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  tracks: {
    orderBy: { position: "asc" },
    where: {
      track: {
        status: PublicationStatus.PUBLISHED,
        album: {
          status: PublicationStatus.PUBLISHED,
          artist: { status: PublicationStatus.PUBLISHED }
        }
      }
    },
    select: { position: true, addedAt: true, track: { select: trackSelect2 } }
  }
};
var create = (ownerId, input) => prisma.playlist.create({
  data: { ...input, ownerId },
  select: playlistSelect
});
async function list(ownerId, page2, limit) {
  const [items, total] = await Promise.all([
    prisma.playlist.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      skip: (page2 - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        visibility: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.playlist.count({ where: { ownerId } })
  ]);
  return { items, total };
}
var get = (id2, userId) => prisma.playlist.findFirst({
  where: {
    id: id2,
    OR: [
      { ownerId: userId },
      {
        visibility: {
          in: [PlaylistVisibility.PUBLIC, PlaylistVisibility.UNLISTED]
        }
      }
    ]
  },
  select: playlistSelect
});
var update = (id2, ownerId, data) => prisma.playlist.updateMany({ where: { id: id2, ownerId }, data });
var remove = (id2, ownerId) => prisma.playlist.deleteMany({ where: { id: id2, ownerId } });
async function add(id2, ownerId, trackId2) {
  return prisma.$transaction(async (tx) => {
    const playlist = await tx.playlist.findFirst({
      where: { id: id2, ownerId },
      select: { id: true }
    });
    if (!playlist) return "missing";
    const track2 = await tx.track.findFirst({
      where: {
        id: trackId2,
        status: PublicationStatus.PUBLISHED,
        album: {
          status: PublicationStatus.PUBLISHED,
          artist: { status: PublicationStatus.PUBLISHED }
        },
        artists: { some: { artist: { status: PublicationStatus.PUBLISHED } } }
      },
      select: { id: true }
    });
    if (!track2) return "track";
    const exists = await tx.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId: id2, trackId: trackId2 } }
    });
    if (exists) return "duplicate";
    const last = await tx.playlistTrack.findFirst({
      where: { playlistId: id2 },
      orderBy: { position: "desc" },
      select: { position: true }
    });
    await tx.playlistTrack.create({
      data: { playlistId: id2, trackId: trackId2, position: (last?.position ?? -1) + 1 }
    });
    return "ok";
  });
}
async function removeTrack(id2, ownerId, trackId2) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.playlist.findFirst({
      where: { id: id2, ownerId },
      select: { id: true }
    });
    if (!p) return "missing";
    const row = await tx.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId: id2, trackId: trackId2 } },
      select: { position: true }
    });
    if (!row) return "missing";
    await tx.playlistTrack.delete({
      where: { playlistId_trackId: { playlistId: id2, trackId: trackId2 } }
    });
    await tx.playlistTrack.updateMany({
      where: { playlistId: id2, position: { gt: row.position } },
      data: { position: { decrement: 1 } }
    });
    return "ok";
  });
}
async function reorder(id2, ownerId, ids) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.playlist.findFirst({
      where: { id: id2, ownerId },
      select: { id: true }
    });
    if (!p) return "missing";
    const rows = await tx.playlistTrack.findMany({
      where: { playlistId: id2 },
      select: { trackId: true }
    });
    if (rows.length !== ids.length || rows.some((r) => !ids.includes(r.trackId)))
      return "mismatch";
    await tx.playlistTrack.updateMany({
      where: { playlistId: id2 },
      data: { position: { increment: ids.length + 1 } }
    });
    for (const [position, trackId2] of ids.entries())
      await tx.playlistTrack.update({
        where: { playlistId_trackId: { playlistId: id2, trackId: trackId2 } },
        data: { position }
      });
    return "ok";
  });
}

// src/validation/playlists.ts
import { z as z5 } from "zod";
var playlistId = z5.object({ id: z5.uuid() });
var trackParams = z5.object({ id: z5.uuid(), trackId: z5.uuid() });
var pageQuery = z5.object({ page: z5.coerce.number().int().min(1).default(1), limit: z5.coerce.number().int().min(1).max(100).default(20) });
var createPlaylist = z5.object({ name: z5.string().trim().min(1).max(100), description: z5.string().trim().max(500).optional(), visibility: z5.enum(["PRIVATE", "PUBLIC", "UNLISTED"]).default("PRIVATE") }).strict();
var updatePlaylist = createPlaylist.partial().refine((v) => Object.keys(v).length > 0, "At least one field is required").strict();
var addTrack = z5.object({ trackId: z5.uuid() }).strict();
var reorder2 = z5.object({ trackIds: z5.array(z5.uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, "Track IDs must be unique") }).strict();

// src/routes/playlists.ts
var playlistsRouter = Router5();
playlistsRouter.use(requireAuth);
var bad2 = (r) => r.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } });
var nf2 = (r) => r.status(404).json({ error: { code: "NOT_FOUND", message: "Playlist not found" } });
var conflict2 = (r) => r.status(409).json({ error: { code: "CONFLICT", message: "Playlist conflict" } });
playlistsRouter.post("/", async (req, res, next) => {
  const b = createPlaylist.safeParse(req.body);
  if (!b.success) return bad2(res);
  try {
    res.status(201).json({ data: await create(res.locals.auth.user.id, b.data) });
  } catch (e) {
    next(e);
  }
});
playlistsRouter.get("/", async (req, res, next) => {
  const q = pageQuery.safeParse(req.query);
  if (!q.success) return bad2(res);
  try {
    const x = await list(res.locals.auth.user.id, q.data.page, q.data.limit);
    res.json({ data: x.items, pagination: { page: q.data.page, limit: q.data.limit, total: x.total, totalPages: Math.ceil(x.total / q.data.limit) } });
  } catch (e) {
    next(e);
  }
});
playlistsRouter.get("/:id", async (req, res, next) => {
  const p = playlistId.safeParse(req.params);
  if (!p.success) return bad2(res);
  try {
    const x = await get(p.data.id, res.locals.auth.user.id);
    if (!x) return nf2(res);
    res.json({ data: x });
  } catch (e) {
    next(e);
  }
});
playlistsRouter.patch("/:id", async (req, res, next) => {
  const p = playlistId.safeParse(req.params), b = updatePlaylist.safeParse(req.body);
  if (!p.success || !b.success) return bad2(res);
  try {
    const x = await update(p.data.id, res.locals.auth.user.id, b.data);
    if (!x.count) return nf2(res);
    res.json({ data: await get(p.data.id, res.locals.auth.user.id) });
  } catch (e) {
    next(e);
  }
});
playlistsRouter.delete("/:id", async (req, res, next) => {
  const p = playlistId.safeParse(req.params);
  if (!p.success) return bad2(res);
  try {
    if (!(await remove(p.data.id, res.locals.auth.user.id)).count) return nf2(res);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
playlistsRouter.post("/:id/tracks", async (req, res, next) => {
  const p = playlistId.safeParse(req.params), b = addTrack.safeParse(req.body);
  if (!p.success || !b.success) return bad2(res);
  try {
    const x = await add(p.data.id, res.locals.auth.user.id, b.data.trackId);
    if (x === "missing" || x === "track") return nf2(res);
    if (x === "duplicate") return conflict2(res);
    res.status(201).json({ data: await get(p.data.id, res.locals.auth.user.id) });
  } catch (e) {
    next(e);
  }
});
playlistsRouter.delete("/:id/tracks/:trackId", async (req, res, next) => {
  const p = trackParams.safeParse(req.params);
  if (!p.success) return bad2(res);
  try {
    const x = await removeTrack(p.data.id, res.locals.auth.user.id, p.data.trackId);
    if (x !== "ok") return nf2(res);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
playlistsRouter.patch("/:id/tracks/reorder", async (req, res, next) => {
  const p = playlistId.safeParse(req.params), b = reorder2.safeParse(req.body);
  if (!p.success || !b.success) return bad2(res);
  try {
    const x = await reorder(p.data.id, res.locals.auth.user.id, b.data.trackIds);
    if (x === "missing") return nf2(res);
    if (x !== "ok") return conflict2(res);
    res.json({ data: await get(p.data.id, res.locals.auth.user.id) });
  } catch (e) {
    next(e);
  }
});

// src/routes/likes-history.ts
import { Router as Router6 } from "express";

// src/validation/likes-history.ts
import { z as z6 } from "zod";
var trackId = z6.object({ id: z6.uuid() });
var historyId = z6.object({ id: z6.uuid() });
var page = z6.object({ page: z6.coerce.number().int().min(1).default(1), limit: z6.coerce.number().int().min(1).max(100).default(20) });
var historyBody = z6.object({ progressSeconds: z6.number().int().min(0).optional(), completed: z6.boolean(), source: z6.enum(["TRACK_PAGE", "ALBUM", "PLAYLIST", "SEARCH", "QUEUE"]).optional() }).strict();

// src/services/likes-history.ts
var track = {
  id: true,
  title: true,
  slug: true,
  trackNumber: true,
  discNumber: true,
  durationSeconds: true,
  album: {
    select: {
      id: true,
      title: true,
      slug: true,
      artist: { select: { id: true, name: true, slug: true } }
    }
  },
  artists: {
    where: { artist: { status: PublicationStatus.PUBLISHED } },
    orderBy: { position: "asc" },
    select: {
      creditType: true,
      position: true,
      artist: { select: { id: true, name: true, slug: true } }
    }
  }
};
var published2 = {
  status: PublicationStatus.PUBLISHED,
  album: {
    status: PublicationStatus.PUBLISHED,
    artist: { status: PublicationStatus.PUBLISHED }
  }
};
async function like(userId, id2) {
  const t = await prisma.track.findFirst({
    where: { id: id2, ...published2 },
    select: { id: true }
  });
  if (!t) return "missing";
  try {
    await prisma.trackLike.create({ data: { userId, trackId: id2 } });
    return "ok";
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002")
      return "duplicate";
    throw e;
  }
}
async function unlike(userId, id2) {
  const r = await prisma.trackLike.deleteMany({
    where: { userId, trackId: id2 }
  });
  return r.count ? "ok" : "missing";
}
async function liked(userId, id2) {
  return !!await prisma.trackLike.findUnique({
    where: { userId_trackId: { userId, trackId: id2 } }
  });
}
async function likedTracks(userId, p, l) {
  const [rows, total] = await Promise.all([
    prisma.trackLike.findMany({
      where: { userId, track: { ...published2 } },
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      select: { createdAt: true, track: { select: track } }
    }),
    prisma.trackLike.count({ where: { userId, track: { ...published2 } } })
  ]);
  return { rows, total };
}
async function history(userId, id2, data) {
  const t = await prisma.track.findFirst({
    where: { id: id2, ...published2 },
    select: { id: true }
  });
  if (!t) return null;
  return prisma.listeningHistory.create({
    data: { userId, trackId: id2, ...data },
    select: {
      id: true,
      trackId: true,
      playedAt: true,
      progressSeconds: true,
      completed: true,
      source: true
    }
  });
}
async function listHistory(userId, p, l) {
  const [rows, total] = await Promise.all([
    prisma.listeningHistory.findMany({
      where: { userId, track: { ...published2 } },
      orderBy: { playedAt: "desc" },
      skip: (p - 1) * l,
      take: l,
      select: {
        id: true,
        playedAt: true,
        progressSeconds: true,
        completed: true,
        source: true,
        track: { select: track }
      }
    }),
    prisma.listeningHistory.count({
      where: { userId, track: { ...published2 } }
    })
  ]);
  return { rows, total };
}
async function deleteHistory(userId, id2) {
  const r = await prisma.listeningHistory.deleteMany({ where: { id: id2, userId } });
  return r.count > 0;
}

// src/routes/likes-history.ts
var likesHistoryRouter = Router6();
likesHistoryRouter.use(requireAuth);
var bad3 = (r) => r.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } });
var nf3 = (r) => r.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
likesHistoryRouter.post("/tracks/:id/like", async (q, r, n) => {
  const p = trackId.safeParse(q.params);
  if (!p.success) return bad3(r);
  try {
    const x = await like(r.locals.auth.user.id, p.data.id);
    if (x === "missing") return nf3(r);
    if (x === "duplicate") return r.status(409).json({ error: { code: "CONFLICT", message: "Already liked" } });
    r.status(201).json({ data: { liked: true } });
  } catch (e) {
    n(e);
  }
});
likesHistoryRouter.delete("/tracks/:id/like", async (q, r, n) => {
  const p = trackId.safeParse(q.params);
  if (!p.success) return bad3(r);
  try {
    await unlike(r.locals.auth.user.id, p.data.id);
    r.json({ data: { liked: false } });
  } catch (e) {
    n(e);
  }
});
likesHistoryRouter.get("/tracks/:id/like", async (q, r, n) => {
  const p = trackId.safeParse(q.params);
  if (!p.success) return bad3(r);
  try {
    r.json({ data: { liked: await liked(r.locals.auth.user.id, p.data.id) } });
  } catch (e) {
    n(e);
  }
});
likesHistoryRouter.get("/me/liked-tracks", async (q, r, n) => {
  const p = page.safeParse(q.query);
  if (!p.success) return bad3(r);
  try {
    const x = await likedTracks(r.locals.auth.user.id, p.data.page, p.data.limit);
    r.json({ data: x.rows, pagination: { page: p.data.page, limit: p.data.limit, total: x.total, totalPages: Math.ceil(x.total / p.data.limit) } });
  } catch (e) {
    n(e);
  }
});
likesHistoryRouter.post("/tracks/:id/history", async (q, r, n) => {
  const p = trackId.safeParse(q.params), b = historyBody.safeParse(q.body);
  if (!p.success || !b.success) return bad3(r);
  try {
    const x = await history(r.locals.auth.user.id, p.data.id, b.data);
    if (!x) return nf3(r);
    r.status(201).json({ data: x });
  } catch (e) {
    n(e);
  }
});
likesHistoryRouter.get("/me/history", async (q, r, n) => {
  const p = page.safeParse(q.query);
  if (!p.success) return bad3(r);
  try {
    const x = await listHistory(r.locals.auth.user.id, p.data.page, p.data.limit);
    r.json({ data: x.rows, pagination: { page: p.data.page, limit: p.data.limit, total: x.total, totalPages: Math.ceil(x.total / p.data.limit) } });
  } catch (e) {
    n(e);
  }
});
likesHistoryRouter.delete("/me/history/:id", async (q, r, n) => {
  const p = historyId.safeParse(q.params);
  if (!p.success) return bad3(r);
  try {
    if (!await deleteHistory(r.locals.auth.user.id, p.data.id)) return nf3(r);
    r.status(204).send();
  } catch (e) {
    n(e);
  }
});

// src/app.ts
var app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.all("/api/auth/{*any}", authRateLimit, toNodeHandler(auth));
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});
app.use("/api/v1", catalogRouter);
app.use("/api/v1/admin", adminCatalogRouter);
app.use("/api/v1/admin/tracks/:id/audio/upload", uploadRateLimit);
app.use("/api/v1/admin/uploads/:id/complete", uploadRateLimit);
app.use("/api/v1", mediaRouter);
app.use("/api/v1/playlists", playlistsRouter);
app.use("/api/v1", likesHistoryRouter);
app.use("/api", authRouter);
app.use((_error, _request, response, _next) => {
  void _next;
  console.error("Unhandled request failure", { error: _error instanceof Error ? _error.name : "UnknownError", method: _request.method, path: _request.path, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
});

// src/server.ts
app.listen(env.PORT, () => {
  console.info(`API listening on http://localhost:${env.PORT}`);
});
