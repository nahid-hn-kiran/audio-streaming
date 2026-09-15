import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { storage } from "../src/storage/s3-storage.js";
import * as catalog from "../src/services/admin-catalog.js";
import * as uploads from "../src/services/uploads.js";
import {
  MediaKind,
  MediaStatus,
  PlaylistVisibility,
  PublicationStatus,
} from "../src/generated/prisma/enums.js";

const demoFlag = process.env.DEMO_DATA_ENABLED === "true";
const productionOverride = process.env.DEMO_DATA_ALLOW_PRODUCTION === "true";
const adminEmail = "nahid.hn.kiran@gmail.com";
const listenerEmail = "nahidhasankiran@gmail.com";
const secondListenerEmail = "nahidforfootball@gmail.com";

type ArtistInput = { name: string; slug: string; bio: string };
type TrackInput = {
  title: string;
  slug: string;
  durationSeconds: number;
  featuredArtist?: string;
  playable?: { durationSeconds: number; frequency: number };
};
type AlbumInput = {
  artist: string;
  title: string;
  slug: string;
  description: string;
  releaseDate: string;
  tracks: TrackInput[];
};

const artists: ArtistInput[] = [
  {
    name: "Aarav Sen",
    slug: "aarav-sen",
    bio: "A Kolkata-born songwriter shaping warm electronic pop from field recordings, soft synths, and late-night melodies.",
  },
  {
    name: "Maya Roy",
    slug: "maya-roy",
    bio: "An intimate vocalist whose spacious songs hold the quiet detail of rain, memory, and starting over.",
  },
  {
    name: "Rihan Kapoor",
    slug: "rihan-kapoor",
    bio: "A producer and multi-instrumentalist pairing patient ambient textures with precise, understated rhythm.",
  },
  {
    name: "The Midnight Project",
    slug: "the-midnight-project",
    bio: "A rotating instrumental collective making cinematic music for long drives and city windows after dark.",
  },
  {
    name: "Elara Vale",
    slug: "elara-vale",
    bio: "A London-based dream-pop artist balancing clear-eyed lyrics with luminous guitars and slow-burning choruses.",
  },
  {
    name: "Kairo North",
    slug: "kairo-north",
    bio: "A percussion-forward producer building agile, nocturnal club music from analog machines and found sound.",
  },
  {
    name: "Nila Hart",
    slug: "nila-hart",
    bio: "A folk singer with a close-mic voice, elegant fingerpicked arrangements, and a talent for small revelations.",
  },
  {
    name: "Serein Coast",
    slug: "serein-coast",
    bio: "An ambient duo composing wide, patient soundscapes that move like weather across an open shoreline.",
  },
];

const albums: AlbumInput[] = [
  {
    artist: "aarav-sen",
    title: "Afterglow",
    slug: "afterglow",
    releaseDate: "2025-09-12",
    description:
      "A luminous set of electronic songs about the few minutes when a city changes colour.",
    tracks: [
      {
        title: "Afterglow",
        slug: "afterglow-1",
        durationSeconds: 214,
        playable: { durationSeconds: 64, frequency: 220 },
      },
      { title: "Borrowed Light", slug: "afterglow-2", durationSeconds: 188 },
      {
        title: "Window Seat",
        slug: "afterglow-3",
        durationSeconds: 241,
        featuredArtist: "maya-roy",
      },
    ],
  },
  {
    artist: "aarav-sen",
    title: "Paper Skies",
    slug: "paper-skies",
    releaseDate: "2024-05-24",
    description:
      "Bright, handmade pop sketches about movement, distance, and finding a way home.",
    tracks: [
      {
        title: "Paper Skies",
        slug: "paper-skies-1",
        durationSeconds: 203,
        playable: { durationSeconds: 58, frequency: 247 },
      },
      { title: "Parallel Lines", slug: "paper-skies-2", durationSeconds: 176 },
      {
        title: "Small Victories",
        slug: "paper-skies-3",
        durationSeconds: 229,
        featuredArtist: "nila-hart",
      },
    ],
  },
  {
    artist: "maya-roy",
    title: "Monsoon Letters",
    slug: "monsoon-letters",
    releaseDate: "2025-07-18",
    description:
      "Acoustic songs written between rainstorms, with close harmonies and a little room to breathe.",
    tracks: [
      {
        title: "Monsoon Letters",
        slug: "monsoon-letters-1",
        durationSeconds: 232,
        playable: { durationSeconds: 72, frequency: 262 },
      },
      {
        title: "The Long Way Home",
        slug: "monsoon-letters-2",
        durationSeconds: 207,
      },
      {
        title: "Blue Hour",
        slug: "monsoon-letters-3",
        durationSeconds: 194,
        featuredArtist: "elara-vale",
      },
    ],
  },
  {
    artist: "rihan-kapoor",
    title: "City Lights",
    slug: "city-lights",
    releaseDate: "2024-11-01",
    description:
      "Neon-toned instrumentals built from restless drums, softened edges, and midnight momentum.",
    tracks: [
      {
        title: "City Lights",
        slug: "city-lights-1",
        durationSeconds: 265,
        playable: { durationSeconds: 83, frequency: 294 },
      },
      {
        title: "Crosswalk",
        slug: "city-lights-2",
        durationSeconds: 218,
        featuredArtist: "kairo-north",
      },
      { title: "Last Train East", slug: "city-lights-3", durationSeconds: 251 },
    ],
  },
  {
    artist: "the-midnight-project",
    title: "Midnight Drive",
    slug: "midnight-drive",
    releaseDate: "2025-02-14",
    description:
      "A widescreen after-hours soundtrack for empty roads, dashboard glow, and the promise of somewhere new.",
    tracks: [
      {
        title: "Midnight Drive",
        slug: "midnight-drive-1",
        durationSeconds: 286,
        playable: { durationSeconds: 91, frequency: 330 },
      },
      { title: "Exit 17", slug: "midnight-drive-2", durationSeconds: 224 },
      {
        title: "Streetlamp Halo",
        slug: "midnight-drive-3",
        durationSeconds: 302,
        featuredArtist: "rihan-kapoor",
      },
    ],
  },
  {
    artist: "the-midnight-project",
    title: "Echoes",
    slug: "echoes",
    releaseDate: "2023-10-06",
    description:
      "Minimal ambient pieces that leave space for the room around them.",
    tracks: [
      {
        title: "Echoes",
        slug: "echoes-1",
        durationSeconds: 318,
        playable: { durationSeconds: 76, frequency: 196 },
      },
      { title: "Soft Focus", slug: "echoes-2", durationSeconds: 274 },
      { title: "Still Water", slug: "echoes-3", durationSeconds: 341 },
    ],
  },
  {
    artist: "elara-vale",
    title: "Glasshouse",
    slug: "glasshouse",
    releaseDate: "2025-06-06",
    description:
      "Dream-pop songs about tenderness, self-protection, and letting the morning in.",
    tracks: [
      {
        title: "Glasshouse",
        slug: "glasshouse-1",
        durationSeconds: 245,
        playable: { durationSeconds: 67, frequency: 349 },
      },
      {
        title: "Hush Signal",
        slug: "glasshouse-2",
        durationSeconds: 219,
        featuredArtist: "maya-roy",
      },
      { title: "Open Door", slug: "glasshouse-3", durationSeconds: 231 },
    ],
  },
  {
    artist: "kairo-north",
    title: "Signal Bloom",
    slug: "signal-bloom",
    releaseDate: "2024-08-30",
    description:
      "Percussive electronic studies where clipped rhythms open into warm, unexpected colour.",
    tracks: [
      {
        title: "Signal Bloom",
        slug: "signal-bloom-1",
        durationSeconds: 198,
        playable: { durationSeconds: 61, frequency: 392 },
      },
      { title: "Low Battery", slug: "signal-bloom-2", durationSeconds: 207 },
      {
        title: "Soft Reset",
        slug: "signal-bloom-3",
        durationSeconds: 226,
        featuredArtist: "aarav-sen",
      },
    ],
  },
  {
    artist: "nila-hart",
    title: "Small Hours",
    slug: "small-hours",
    releaseDate: "2025-03-21",
    description:
      "A tender folk record for kitchen lights, unfinished letters, and the courage to begin again.",
    tracks: [
      {
        title: "Small Hours",
        slug: "small-hours-1",
        durationSeconds: 257,
        playable: { durationSeconds: 69, frequency: 262 },
      },
      { title: "Northbound", slug: "small-hours-2", durationSeconds: 213 },
      { title: "The Orchard", slug: "small-hours-3", durationSeconds: 238 },
    ],
  },
  {
    artist: "serein-coast",
    title: "Tidal Memory",
    slug: "tidal-memory",
    releaseDate: "2024-04-19",
    description:
      "Slow-moving ambient compositions shaped by shoreline recordings and long, open harmonies.",
    tracks: [
      {
        title: "Tidal Memory",
        slug: "tidal-memory-1",
        durationSeconds: 365,
        playable: { durationSeconds: 88, frequency: 174 },
      },
      { title: "Weather Map", slug: "tidal-memory-2", durationSeconds: 288 },
      {
        title: "Far Shore",
        slug: "tidal-memory-3",
        durationSeconds: 397,
        featuredArtist: "the-midnight-project",
      },
    ],
  },
  {
    artist: "elara-vale",
    title: "Night Garden",
    slug: "night-garden",
    releaseDate: "2023-09-15",
    description:
      "A nocturnal companion to Glasshouse, full of velvet synths and songs that refuse easy endings.",
    tracks: [
      { title: "Night Garden", slug: "night-garden-1", durationSeconds: 248 },
      { title: "Lunar Thread", slug: "night-garden-2", durationSeconds: 236 },
      { title: "Velvet Weather", slug: "night-garden-3", durationSeconds: 261 },
    ],
  },
  {
    artist: "rihan-kapoor",
    title: "Still Moving",
    slug: "still-moving",
    releaseDate: "2023-05-12",
    description:
      "A patient collection of piano, tape, and modular studies for focused afternoons.",
    tracks: [
      { title: "Still Moving", slug: "still-moving-1", durationSeconds: 276 },
      { title: "Contour", slug: "still-moving-2", durationSeconds: 249 },
      { title: "Afterimage", slug: "still-moving-3", durationSeconds: 305 },
    ],
  },
];

const playlists = [
  {
    name: "First Light",
    description:
      "Gentle starts, clear heads, and a little momentum before the day gets loud.",
    visibility: PlaylistVisibility.PUBLIC,
    tracks: [
      "paper-skies-1",
      "small-hours-1",
      "afterglow-1",
      "monsoon-letters-1",
      "glasshouse-1",
      "tidal-memory-1",
      "echoes-1",
      "city-lights-1",
      "signal-bloom-1",
      "midnight-drive-1",
    ],
  },
  {
    name: "Night Bus Home",
    description:
      "A window-seat sequence for the ride back through a city that is still awake.",
    visibility: PlaylistVisibility.PUBLIC,
    tracks: [
      "city-lights-1",
      "midnight-drive-1",
      "echoes-1",
      "afterglow-1",
      "signal-bloom-1",
      "glasshouse-1",
      "tidal-memory-1",
      "monsoon-letters-1",
      "paper-skies-1",
      "small-hours-1",
    ],
  },
  {
    name: "Soft Focus",
    description:
      "Low light, open space, and songs that do not ask for your full attention.",
    visibility: PlaylistVisibility.UNLISTED,
    tracks: [
      "echoes-1",
      "tidal-memory-1",
      "monsoon-letters-1",
      "glasshouse-1",
      "small-hours-1",
      "afterglow-1",
      "paper-skies-1",
      "midnight-drive-1",
      "city-lights-1",
      "signal-bloom-1",
    ],
  },
  {
    name: "Keep Moving",
    description:
      "A quietly propulsive rotation for walks, trains, and making progress.",
    visibility: PlaylistVisibility.PRIVATE,
    tracks: [
      "signal-bloom-1",
      "city-lights-1",
      "paper-skies-1",
      "midnight-drive-1",
      "afterglow-1",
      "small-hours-1",
      "glasshouse-1",
      "monsoon-letters-1",
      "tidal-memory-1",
      "echoes-1",
    ],
  },
];

const playableTracks = new Map(
  albums.flatMap((album) =>
    album.tracks
      .filter((track) => track.playable)
      .map((track) => [track.slug, track.playable!] as const),
  ),
);

function wav(seconds: number, baseFrequency: number): Buffer {
  const rate = 22_050;
  const samples = rate * seconds;
  const data = Buffer.alloc(samples * 2);
  const notes = [1, 1.125, 1.25, 1.5, 1.25, 1.125, 1.75, 1.5];
  for (let index = 0; index < samples; index += 1) {
    const time = index / rate;
    const note = notes[Math.floor(time / 0.75) % notes.length];
    const beat = Math.max(0, Math.sin((time * Math.PI * 2) / 0.75));
    const pad = Math.sin(time * Math.PI * 2 * baseFrequency) * 0.22;
    const lead =
      Math.sin(time * Math.PI * 2 * baseFrequency * note) *
      (0.24 + beat * 0.16);
    const fifth =
      Math.sin(time * Math.PI * 2 * baseFrequency * note * 1.5) * 0.1;
    const kick =
      Math.sin(time * Math.PI * 2 * (70 - Math.min(time % 0.75, 0.2) * 100)) *
      (time % 0.75 < 0.12 ? 0.22 : 0);
    const envelope = Math.min(1, time / 1.5, (seconds - time) / 2);
    const sample = Math.max(
      -1,
      Math.min(1, (pad + lead + fifth + kick) * envelope),
    );
    data.writeInt16LE(Math.round(sample * 14_000), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function ensureArtist(input: ArtistInput) {
  const existing = await prisma.artist.findUnique({
    where: { slug: input.slug },
  });
  if (existing)
    return prisma.artist.update({
      where: { id: existing.id },
      data: { name: input.name, bio: input.bio },
    });
  return prisma.artist.create({
    data: { ...input, status: PublicationStatus.DRAFT },
  });
}

async function ensureAlbum(input: AlbumInput, artistId: string) {
  const existing = await prisma.album.findUnique({
    where: { slug: input.slug },
  });
  if (existing && existing.artistId !== artistId)
    throw new Error(
      `Managed album slug belongs to another artist: ${input.slug}`,
    );
  if (existing)
    return prisma.album.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        releaseDate: new Date(input.releaseDate),
      },
    });
  return prisma.album.create({
    data: {
      artistId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      releaseDate: new Date(input.releaseDate),
      status: PublicationStatus.DRAFT,
    },
  });
}

async function ensureTrack(
  input: TrackInput,
  albumId: string,
  primaryArtistId: string,
  featuredArtistId?: string,
) {
  const existing = await prisma.track.findUnique({
    where: { slug: input.slug },
    select: { id: true, albumId: true, mediaAssetId: true },
  });
  if (existing && existing.albumId !== albumId)
    throw new Error(
      `Managed track slug belongs to another album: ${input.slug}`,
    );
  const track = existing
    ? await prisma.track.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          durationSeconds: input.durationSeconds,
          trackNumber: Number(input.slug.split("-").at(-1)),
          discNumber: 1,
        },
      })
    : await prisma.track.create({
        data: {
          albumId,
          title: input.title,
          slug: input.slug,
          trackNumber: Number(input.slug.split("-").at(-1)),
          discNumber: 1,
          durationSeconds: input.durationSeconds,
          status: PublicationStatus.DRAFT,
        },
      });
  await prisma.trackArtist.deleteMany({ where: { trackId: track.id } });
  await prisma.trackArtist.createMany({
    data: [
      {
        trackId: track.id,
        artistId: primaryArtistId,
        creditType: "PRIMARY",
        position: 0,
      },
      ...(featuredArtistId
        ? [
            {
              trackId: track.id,
              artistId: featuredArtistId,
              creditType: "FEATURED" as const,
              position: 1,
            },
          ]
        : []),
    ],
  });
  return { ...track, mediaAssetId: existing?.mediaAssetId ?? null };
}

async function attachAudio(
  track: { id: string; slug: string; mediaAssetId: string | null },
  adminId: string,
  audioDir: string,
) {
  const specification = playableTracks.get(track.slug);
  if (!specification) return false;
  if (track.mediaAssetId) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: track.mediaAssetId },
      select: { kind: true, status: true },
    });
    if (
      !asset ||
      asset.kind !== MediaKind.AUDIO ||
      asset.status !== MediaStatus.READY
    )
      throw new Error(
        `Existing media is not READY audio for ${track.slug}; refusing to create a replacement.`,
      );
    return true;
  }
  const bytes = wav(specification.durationSeconds, specification.frequency);
  const filename = `${track.slug}.wav`;
  await writeFile(join(audioDir, filename), bytes);
  const started = await uploads.initiate(
    track.id,
    adminId,
    { filename, contentType: "audio/wav", byteSize: bytes.length },
    storage,
  );
  if (!started)
    throw new Error(`Could not initiate demo audio upload for ${track.slug}`);
  const put = await fetch(started.url, {
    method: "PUT",
    headers: { "content-type": "audio/wav" },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Demo audio upload failed for ${track.slug}`);
  const completed = await uploads.complete(started.upload.id, adminId, storage);
  if (completed.kind !== "done" || !completed.assetId)
    throw new Error(`Demo audio verification failed for ${track.slug}`);
  return true;
}

async function seedLibrary(
  ownerId: string,
  listenerIds: string[],
  trackIds: Map<string, string>,
) {
  for (const input of playlists) {
    const playlist = await prisma.playlist.upsert({
      where: { ownerId_name: { ownerId, name: input.name } },
      update: { description: input.description, visibility: input.visibility },
      create: {
        ownerId,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
      },
      select: { id: true },
    });
    await prisma.playlistTrack.deleteMany({
      where: { playlistId: playlist.id },
    });
    await prisma.playlistTrack.createMany({
      data: input.tracks.map((slug, position) => ({
        playlistId: playlist.id,
        trackId: trackIds.get(slug)!,
        position,
      })),
    });
  }
  const playableIds = [...trackIds.values()];
  for (let index = 0; index < 20; index += 1)
    await prisma.trackLike.createMany({
      data: [
        {
          userId: listenerIds[index % listenerIds.length],
          trackId: playableIds[index % playableIds.length],
        },
      ],
      skipDuplicates: true,
    });
  const sources = ["PLAYLIST", "ALBUM", "TRACK_PAGE", "QUEUE"] as const;
  const base = new Date("2026-08-01T12:00:00.000Z");
  for (let index = 0; index < 40; index += 1) {
    const userId = listenerIds[index % listenerIds.length];
    const trackId = playableIds[index % playableIds.length];
    const playedAt = new Date(base.getTime() + index * 86_400_000);
    const source = sources[index % sources.length];
    const exists = await prisma.listeningHistory.findFirst({
      where: { userId, trackId, playedAt, source },
    });
    if (!exists)
      await prisma.listeningHistory.create({
        data: {
          userId,
          trackId,
          playedAt,
          progressSeconds: 20 + (index % 50),
          completed: index % 3 !== 0,
          source,
        },
      });
  }
}

async function main() {
  if (!demoFlag)
    throw new Error(
      "Demo seed blocked. Set DEMO_DATA_ENABLED=true intentionally before running seed:demo.",
    );
  if (env.NODE_ENV === "production" && !productionOverride)
    throw new Error(
      "Demo seed blocked in production. Set DEMO_DATA_ALLOW_PRODUCTION=true only for an intentional production demo-data run.",
    );
  if (
    !env.OBJECT_STORAGE_ENDPOINT ||
    !env.OBJECT_STORAGE_BUCKET ||
    !env.OBJECT_STORAGE_ACCESS_KEY_ID ||
    !env.OBJECT_STORAGE_SECRET_ACCESS_KEY
  )
    throw new Error(
      "Object storage is not configured; demo metadata/audio was not seeded.",
    );
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, role: true },
  });
  const listener = await prisma.user.findUnique({
    where: { email: listenerEmail },
    select: { id: true },
  });
  const secondListener = await prisma.user.findUnique({
    where: { email: secondListenerEmail },
    select: { id: true },
  });
  if (!admin || admin.role !== "ADMIN")
    throw new Error("Seed an ADMIN account before running seed:demo.");
  if (!listener || !secondListener)
    throw new Error(
      "Seed the existing development users before running seed:demo.",
    );
  const audioDir = join(process.cwd(), "demo-audio");
  await mkdir(audioDir, { recursive: true });
  const artistBySlug = new Map<string, { id: string }>();
  for (const input of artists) {
    const artist = await ensureArtist(input);
    if (artist.status !== PublicationStatus.PUBLISHED)
      await catalog.changePublication(
        "artist",
        artist.id,
        PublicationStatus.PUBLISHED,
      );
    artistBySlug.set(input.slug, artist);
  }
  const playableBySlug = new Map<string, string>();
  let featuredCreditCount = 0;
  for (const albumInput of albums) {
    const artist = artistBySlug.get(albumInput.artist);
    if (!artist) throw new Error(`Missing demo artist ${albumInput.artist}`);
    const album = await ensureAlbum(albumInput, artist.id);
    if (album.status !== PublicationStatus.PUBLISHED)
      await catalog.changePublication(
        "album",
        album.id,
        PublicationStatus.PUBLISHED,
      );
    for (const trackInput of albumInput.tracks) {
      const featuredArtist = trackInput.featuredArtist
        ? artistBySlug.get(trackInput.featuredArtist)
        : undefined;
      const track = await ensureTrack(
        trackInput,
        album.id,
        artist.id,
        featuredArtist?.id,
      );
      if (featuredArtist) featuredCreditCount += 1;
      const hasAudio = await attachAudio(track, admin.id, audioDir);
      const refreshed = await prisma.track.findUniqueOrThrow({
        where: { id: track.id },
        select: { mediaAssetId: true, status: true },
      });
      if (hasAudio && refreshed.mediaAssetId) {
        const media = await prisma.mediaAsset.findUnique({
          where: { id: refreshed.mediaAssetId },
          select: { kind: true, status: true },
        });
        if (
          !media ||
          media.kind !== MediaKind.AUDIO ||
          media.status !== MediaStatus.READY
        )
          throw new Error(`Demo media is not READY for ${trackInput.slug}`);
        if (refreshed.status !== PublicationStatus.PUBLISHED)
          await catalog.changePublication(
            "track",
            track.id,
            PublicationStatus.PUBLISHED,
          );
        playableBySlug.set(trackInput.slug, track.id);
      }
    }
  }
  if (playableBySlug.size !== 10)
    throw new Error(
      `Expected 10 playable demo tracks, found ${playableBySlug.size}`,
    );
  await seedLibrary(
    listener.id,
    [listener.id, secondListener.id],
    playableBySlug,
  );
  console.log(
    JSON.stringify({
      artists: 8,
      albums: 12,
      tracks: 36,
      featuredCredits: featuredCreditCount,
      playableTracks: playableBySlug.size,
      generatedAudioFiles: 10,
      playlists: 4,
      playlistTracks: 40,
      likes: 20,
      listeningHistory: 40,
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Demo seed failed safely.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
