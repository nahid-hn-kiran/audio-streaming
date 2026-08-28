import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { storage } from "../src/storage/s3-storage.js";
import * as catalog from "../src/services/admin-catalog.js";
import * as uploads from "../src/services/uploads.js";
import { MediaStatus, PublicationStatus } from "../src/generated/prisma/enums.js";

const adminEmail = "nahid.hn.kiran@gmail.com";
const artists = [
  { name: "Aarav Sen", slug: "aarav-sen", bio: "Demo artist exploring warm electronic songwriting." },
  { name: "Maya Roy", slug: "maya-roy", bio: "Demo vocalist with an intimate, nocturnal sound." },
  { name: "Rihan Kapoor", slug: "rihan-kapoor", bio: "Demo producer blending ambient textures and rhythm." },
  { name: "The Midnight Project", slug: "the-midnight-project", bio: "A fictional late-night instrumental collective." },
];
const albums = [
  { artist: "aarav-sen", title: "Afterglow", slug: "afterglow", description: "Fictional songs for the last light of day." },
  { artist: "aarav-sen", title: "Paper Skies", slug: "paper-skies", description: "A small collection of bright demo sketches." },
  { artist: "maya-roy", title: "Monsoon Letters", slug: "monsoon-letters", description: "Fictional acoustic notes from a rainy season." },
  { artist: "rihan-kapoor", title: "City Lights", slug: "city-lights", description: "Neon-toned instrumental demo pieces." },
  { artist: "the-midnight-project", title: "Midnight Drive", slug: "midnight-drive", description: "A fictional after-hours soundtrack." },
  { artist: "the-midnight-project", title: "Echoes", slug: "echoes", description: "Minimal ambient demo recordings." },
];

function wav(seconds: number, frequency: number): Buffer {
  const rate = 8000; const samples = rate * seconds; const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 12000), i * 2);
  const header = Buffer.alloc(44); header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8); header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40); return Buffer.concat([header, data]);
}

async function main() {
  if (!env.OBJECT_STORAGE_ENDPOINT || !env.OBJECT_STORAGE_BUCKET || !env.OBJECT_STORAGE_ACCESS_KEY_ID || !env.OBJECT_STORAGE_SECRET_ACCESS_KEY) throw new Error("Object storage is not configured; demo metadata/audio was not seeded.");
  const admin = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
  if (!admin) throw new Error("Seed an ADMIN account before running seed:demo.");
  const audioDir = join(process.cwd(), "demo-audio"); await mkdir(audioDir, { recursive: true });
  const artistBySlug = new Map<string, { id: string }>();
  for (const input of artists) { let artist = await prisma.artist.findUnique({ where: { slug: input.slug }, select: { id: true, status: true } }); if (!artist) artist = await catalog.createArtist(input); if (artist.status !== PublicationStatus.PUBLISHED) await catalog.changePublication("artist", artist.id, PublicationStatus.PUBLISHED); artistBySlug.set(input.slug, artist); }
  let trackNumber = 0;
  for (const input of albums) {
    const artist = artistBySlug.get(input.artist); if (!artist) throw new Error(`Missing demo artist ${input.artist}`);
    let album = await prisma.album.findUnique({ where: { slug: input.slug }, select: { id: true, status: true, artistId: true } }); if (!album) album = await catalog.createAlbum({ title: input.title, slug: input.slug, description: input.description, artistId: artist.id }); if (album.status !== PublicationStatus.PUBLISHED) await catalog.changePublication("album", album.id, PublicationStatus.PUBLISHED);
    for (let n = 1; n <= 2; n += 1) { const slug = `${input.slug}-${n}`; let track = await prisma.track.findUnique({ where: { slug }, select: { id: true, status: true, mediaAssetId: true } }); if (!track) track = await catalog.createTrack({ albumId: album.id, title: `${input.title} ${n}`, slug, trackNumber: n, discNumber: 1, durationSeconds: 3, artists: [{ artistId: artist.id, creditType: "PRIMARY", position: 0 }] });
      if (!track.mediaAssetId) { const bytes = wav(3, 220 + (trackNumber++ * 37)); const filename = `${slug}.wav`; await writeFile(join(audioDir, filename), bytes); const started = await uploads.initiate(track.id, admin.id, { filename, contentType: "audio/wav", byteSize: bytes.length }, storage); const put = await fetch(started.url, { method: "PUT", headers: { "content-type": "audio/wav" }, body: bytes }); if (!put.ok) throw new Error(`Demo audio upload failed for ${slug}`); const completed = await uploads.complete(started.upload.id, admin.id, storage); if (completed.kind !== "done" || !completed.assetId) throw new Error(`Demo audio verification failed for ${slug}`); track = { ...track, mediaAssetId: completed.assetId }; }
      const media = await prisma.mediaAsset.findUnique({ where: { id: track.mediaAssetId ?? "" }, select: { status: true } }); if (!media || media.status !== MediaStatus.READY) throw new Error(`Demo media is not READY for ${slug}`); if (track.status !== PublicationStatus.PUBLISHED) await catalog.changePublication("track", track.id, PublicationStatus.PUBLISHED);
    }
  }
  console.log("Demo catalog seeded and published with verified audio media.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Demo seed failed safely."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
