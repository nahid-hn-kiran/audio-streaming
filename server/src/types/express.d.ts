import type { AuthSession } from "../auth.js";

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthSession;
    }
  }
}

export {};

