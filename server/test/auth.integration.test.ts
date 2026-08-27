import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const run = process.env.RUN_AUTH_INTEGRATION_TESTS === "1";
const suite = run ? describe : describe.skip;
let server: ReturnType<typeof app.listen>;
let baseURL = "";
const email = `auth-test-${Date.now()}@example.com`;
const password = "correct-horse-battery-staple";
let userId = "";
let userCookie = "";
let adminCookie = "";

async function request(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${baseURL}${path}`, { ...init, headers });
}

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

suite("Better Auth integration", () => {
  before(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  after(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  test("registration ignores a client-supplied ADMIN role", async () => {
    const response = await request("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name: "Auth Test", email, password, role: "ADMIN" }),
    });
    const responseText = await response.text();
    assert.ok(response.ok, responseText);
    const body = JSON.parse(responseText) as { user?: { id: string; role?: string } };
    userId = body.user?.id ?? "";
    const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(storedUser.role, "USER");
    userCookie = cookieFrom(response);
    assert.ok(userCookie);
  });

  test("login, session retrieval, and logout work", async () => {
    const login = await request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    assert.ok(login.ok, await login.text());
    const cookie = cookieFrom(login);
    assert.ok(cookie);
    const session = await request("/api/auth/get-session", {}, cookie);
    assert.equal(session.status, 200);
    const sessionBody = await session.text();
    assert.equal(sessionBody.includes(password), false);
    assert.equal(sessionBody.includes(password), false);
    const logout = await request("/api/auth/sign-out", { method: "POST" }, cookie);
    assert.ok(logout.ok, await logout.text());
  });

  test("protected routes enforce authentication and roles", async () => {
    assert.equal((await request("/api/me")).status, 401);
    assert.equal((await request("/api/admin-check", {}, userCookie)).status, 403);
    await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
    const login = await request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    adminCookie = cookieFrom(login);
    assert.equal((await request("/api/admin-check", {}, adminCookie)).status, 200);
  });

  test("CORS rejects unconfigured origins and auth responses expose no credentials", async () => {
    const response = await request("/api/me", { headers: { origin: "https://untrusted.example" } }, adminCookie);
    assert.notEqual(response.headers.get("access-control-allow-origin"), "https://untrusted.example");
    const body = await response.text();
    for (const secret of [password, userCookie, adminCookie]) assert.equal(body.includes(secret), false);
  });
});
