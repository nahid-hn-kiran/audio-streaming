import { Router } from "express";
import { listArtists, getAlbum, getArtist, getTrack } from "../services/catalog.js";
import { albumSlugSchema, artistSlugSchema, paginationSchema, trackIdSchema } from "../validation/catalog.js";

export const catalogRouter = Router();

function validationError(response: Parameters<Parameters<typeof catalogRouter.get>[1]>[1], message = "Invalid request parameters") {
  response.status(400).json({ error: { code: "INVALID_REQUEST", message } });
}

function notFound(response: Parameters<Parameters<typeof catalogRouter.get>[1]>[1]) {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Catalog resource not found" } });
}

catalogRouter.get("/artists", async (request, response, next) => {
  const parsed = paginationSchema.safeParse(request.query);
  if (!parsed.success) return validationError(response);
  try {
    const { items, total } = await listArtists(parsed.data.page, parsed.data.limit);
    response.json({ data: items, pagination: { page: parsed.data.page, limit: parsed.data.limit, total, totalPages: Math.ceil(total / parsed.data.limit) } });
  } catch (error) { next(error); }
});

catalogRouter.get("/artists/:slug", async (request, response, next) => {
  const parsed = artistSlugSchema.safeParse(request.params);
  if (!parsed.success) return validationError(response);
  try { const item = await getArtist(parsed.data.slug); if (!item) return notFound(response); response.json({ data: item }); } catch (error) { next(error); }
});

catalogRouter.get("/albums/:slug", async (request, response, next) => {
  const parsed = albumSlugSchema.safeParse(request.params);
  if (!parsed.success) return validationError(response);
  try { const item = await getAlbum(parsed.data.slug); if (!item) return notFound(response); response.json({ data: item }); } catch (error) { next(error); }
});

catalogRouter.get("/tracks/:id", async (request, response, next) => {
  const parsed = trackIdSchema.safeParse(request.params);
  if (!parsed.success) return validationError(response);
  try { const item = await getTrack(parsed.data.id); if (!item) return notFound(response); response.json({ data: item }); } catch (error) { next(error); }
});
