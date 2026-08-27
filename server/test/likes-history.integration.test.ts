import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { app } from "../src/app.js";

const suite = process.env.RUN_LIKES_HISTORY_INTEGRATION_TESTS === "1" ? describe : describe.skip;
suite("Likes and history integration", () => {
  test("unauthenticated like and history requests require authentication", async () => {
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as { port: number }).port;
    const invalid = "00000000-0000-0000-0000-000000000000";
    try {
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/tracks/${invalid}/like`, { method: "POST" })).status, 401);
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/tracks/${invalid}/history`, { method: "POST" })).status, 401);
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/me/history`)).status, 401);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
