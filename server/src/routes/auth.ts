import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/me", requireAuth, (_request, response) => {
  const user = response.locals.auth?.user;

  response.status(200).json({
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        }
      : null,
  });
});

authRouter.get("/admin-check", requireAuth, requireAdmin, (_request, response) => {
  response.status(200).json({ authorized: true });
});

