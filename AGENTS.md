# Development Rules

- Keep the frontend in `client/` and the REST API in `server/`; do not introduce a workspace or shared package until it is needed.
- Use TypeScript, explicit API contracts, Zod validation at system boundaries, and consistent HTTP error responses.
- Keep business and data-access logic in the API. The client must not access PostgreSQL or storage credentials.
- Use PostgreSQL through Prisma. Store media files in object storage, not the database.
- Authenticate and authorize on the server. Enforce both role (`USER`, `ADMIN`) and resource ownership checks.
- Never commit secrets. Read configuration from documented environment variables and update `.env.example` when adding one.
- Prefer simple, shippable solutions. Do not add services, packages, or abstractions without a current requirement.
- Treat unpublished catalog content and administrative actions as protected resources.
- Add tests alongside behavior when business features are introduced; preserve the health check as a deployment probe.

