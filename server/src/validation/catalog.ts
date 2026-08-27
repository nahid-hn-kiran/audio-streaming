import { z } from "zod";

export const artistSlugSchema = z.object({ slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });
export const albumSlugSchema = artistSlugSchema;
export const trackIdSchema = z.object({ id: z.uuid() });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
