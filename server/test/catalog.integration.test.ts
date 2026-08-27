import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const suite = process.env.RUN_CATALOG_INTEGRATION_TESTS === "1" ? describe : describe.skip;
let server: ReturnType<typeof app.listen>;
let baseURL = "";
let publishedArtistId = "";
let publishedAlbumId = "";
let publishedTrackId = "";
const unpublishedSlug = `hidden-${Date.now()}`;

suite("Public catalog API", () => {
  before(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const artist = await prisma.artist.create({ data: { name: "Catalog Test Artist", slug: `catalog-${Date.now()}`, status: "PUBLISHED" } });
    publishedArtistId = artist.id;
    const album = await prisma.album.create({ data: { artistId: artist.id, title: "Catalog Test Album", slug: `catalog-album-${Date.now()}`, status: "PUBLISHED" } });
    publishedAlbumId = album.id;
    const track = await prisma.track.create({ data: { albumId: album.id, title: "Catalog Test Track", slug: `catalog-track-${Date.now()}`, trackNumber: 1, status: "PUBLISHED" } });
    publishedTrackId = track.id;
    await prisma.trackArtist.create({ data: { trackId: track.id, artistId: artist.id } });
    await prisma.artist.create({ data: { name: "Hidden Artist", slug: unpublishedSlug, status: "DRAFT" } });
  });

  after(async () => {
    await prisma.trackArtist.deleteMany({ where: { trackId: publishedTrackId } });
    await prisma.track.delete({ where: { id: publishedTrackId } });
    await prisma.album.delete({ where: { id: publishedAlbumId } });
    await prisma.artist.deleteMany({ where: { id: { in: [publishedArtistId] } } });
    await prisma.artist.deleteMany({ where: { slug: unpublishedSlug } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  test("returns published artists with pagination", async () => {
    const response = await fetch(`${baseURL}/api/v1/artists?page=1&limit=1`);
    assert.equal(response.status, 200);
    const body = await response.json() as { data: Array<{ slug: string }>; pagination: { page: number; limit: number } };
    assert.equal(body.pagination.limit, 1);
    assert.equal(body.data.length, 1);
  });

  test("returns published artist, album, and track relationships", async () => {
    const artist = await fetch(`${baseURL}/api/v1/artists/${(await prisma.artist.findUniqueOrThrow({ where: { id: publishedArtistId } })).slug}`);
    assert.equal(artist.status, 200);
    const album = await fetch(`${baseURL}/api/v1/albums/${(await prisma.album.findUniqueOrThrow({ where: { id: publishedAlbumId } })).slug}`);
    assert.equal(album.status, 200);
    const track = await fetch(`${baseURL}/api/v1/tracks/${publishedTrackId}`);
    assert.equal(track.status, 200);
    const body = await track.json() as { data: { album: { id: string }; artists: Array<{ artist: { id: string } }> } };
    assert.equal(body.data.album.id, publishedAlbumId);
    assert.equal(body.data.artists[0]?.artist.id, publishedArtistId);
  });

  test("hides unpublished resources and returns consistent errors", async () => {
    assert.equal((await fetch(`${baseURL}/api/v1/artists/${unpublishedSlug}`)).status, 404);
    assert.equal((await fetch(`${baseURL}/api/v1/artists/not valid`)).status, 400);
    assert.equal((await fetch(`${baseURL}/api/v1/tracks/not-a-uuid`)).status, 400);
    const missing = await fetch(`${baseURL}/api/v1/albums/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: { code: "NOT_FOUND", message: "Catalog resource not found" } });
  });
});
