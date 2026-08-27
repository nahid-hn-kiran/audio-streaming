import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { adminIdSchema, createAlbumSchema, createArtistSchema, createTrackSchema, updateAlbumSchema, updateArtistSchema, updateTrackSchema } from "../validation/admin-catalog.js";
import * as service from "../services/admin-catalog.js";
import { PublicationStatus } from "../generated/prisma/enums.js";

export const adminCatalogRouter = Router();
adminCatalogRouter.use(requireAuth, requireAdmin);

function invalid(response: Response) { response.status(400).json({ error: { code: "INVALID_REQUEST", message: "Invalid request" } }); }
function notFound(response: Response) { response.status(404).json({ error: { code: "NOT_FOUND", message: "Catalog resource not found" } }); }
function conflict(response: Response, message = "Catalog resource conflicts with an existing record") { response.status(409).json({ error: { code: "CONFLICT", message } }); }
function dependency(response: Response, message: string) { response.status(409).json({ error: { code: "PUBLICATION_DEPENDENCY", message } }); }
function handle(error: unknown, response: Response, next: (error?: unknown) => void) { if (service.isConflict(error)) return conflict(response, "A resource with that slug or position already exists"); if (service.isMissing(error)) return notFound(response); next(error); }

adminCatalogRouter.post("/artists", async (request, response, next) => { const parsed = createArtistSchema.safeParse(request.body); if (!parsed.success) return invalid(response); try { response.status(201).json({ data: await service.createArtist(parsed.data) }); } catch (error) { handle(error, response, next); } });
adminCatalogRouter.patch("/artists/:id", async (request, response, next) => { const params = adminIdSchema.safeParse(request.params); const body = updateArtistSchema.safeParse(request.body); if (!params.success || !body.success) return invalid(response); try { response.json({ data: await service.updateArtist(params.data.id, body.data) }); } catch (error) { handle(error, response, next); } });
adminCatalogRouter.post("/artists/:id/publish", async (request, response, next) => change(request, response, next, "artist", PublicationStatus.PUBLISHED));
adminCatalogRouter.post("/artists/:id/archive", async (request, response, next) => change(request, response, next, "artist", PublicationStatus.ARCHIVED));

adminCatalogRouter.post("/albums", async (request, response, next) => { const parsed = createAlbumSchema.safeParse(request.body); if (!parsed.success) return invalid(response); try { response.status(201).json({ data: await service.createAlbum(parsed.data) }); } catch (error) { handle(error, response, next); } });
adminCatalogRouter.patch("/albums/:id", async (request, response, next) => { const params = adminIdSchema.safeParse(request.params); const body = updateAlbumSchema.safeParse(request.body); if (!params.success || !body.success) return invalid(response); try { response.json({ data: await service.updateAlbum(params.data.id, body.data) }); } catch (error) { handle(error, response, next); } });
adminCatalogRouter.post("/albums/:id/publish", async (request, response, next) => change(request, response, next, "album", PublicationStatus.PUBLISHED));
adminCatalogRouter.post("/albums/:id/archive", async (request, response, next) => change(request, response, next, "album", PublicationStatus.ARCHIVED));

adminCatalogRouter.post("/tracks", async (request, response, next) => { const parsed = createTrackSchema.safeParse(request.body); if (!parsed.success) return invalid(response); try { response.status(201).json({ data: await service.createTrack(parsed.data) }); } catch (error) { handle(error, response, next); } });
adminCatalogRouter.patch("/tracks/:id", async (request, response, next) => { const params = adminIdSchema.safeParse(request.params); const body = updateTrackSchema.safeParse(request.body); if (!params.success || !body.success) return invalid(response); try { response.json({ data: await service.updateTrack(params.data.id, body.data) }); } catch (error) { handle(error, response, next); } });
adminCatalogRouter.post("/tracks/:id/publish", async (request, response, next) => change(request, response, next, "track", PublicationStatus.PUBLISHED));
adminCatalogRouter.post("/tracks/:id/archive", async (request, response, next) => change(request, response, next, "track", PublicationStatus.ARCHIVED));

async function change(request: Request, response: Response, next: NextFunction, resource: "artist" | "album" | "track", status: PublicationStatus) {
  const params = adminIdSchema.safeParse(request.params);
  if (!params.success) return invalid(response);
  try {
    const result = await service.changePublication(resource, params.data.id, status);
    if (!result) return notFound(response);
    response.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "PARENT_NOT_PUBLISHED") return dependency(response, "The parent resource must be published first");
    if (error instanceof Error && error.message === "PRIMARY_ARTIST_REQUIRED") return dependency(response, "A published primary artist is required before publishing a track");
    handle(error, response, next);
  }
}
