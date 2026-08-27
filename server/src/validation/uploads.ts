import { z } from "zod";
import { env } from "../config/env.js";
const mime = z.enum(["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac"]);
const filename = z.string().min(1).max(255).refine((v) => !/[\\/]/.test(v) && [...v].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127), "Invalid filename");
export const uploadTrackParams = z.object({ id: z.uuid() });
export const uploadIdParams = z.object({ id: z.uuid() });
export const initiateUpload = z.object({ filename, contentType: mime, byteSize: z.number().int().min(1).max(env.MAX_AUDIO_UPLOAD_BYTES), checksum: z.string().regex(/^[A-Za-z0-9+/=_-]+$/).max(256).optional() }).strict();
