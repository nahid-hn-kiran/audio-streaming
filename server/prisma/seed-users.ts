import { hashPassword } from "better-auth/crypto";
import { auth } from "../src/auth.js";
import { prisma } from "../src/lib/prisma.js";
import { Role } from "../src/generated/prisma/client.js";

type SeedUser = { email: string; password: string; role: Role; name: string };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to seed development users`);
  return value;
}

const users: SeedUser[] = [
  { email: "nahid.hn.kiran@gmail.com", password: required("SEED_ADMIN_PASSWORD"), role: Role.ADMIN, name: "Nahid H. N. Kiran" },
  { email: "nahidforfootball@gmail.com", password: required("SEED_ADMIN_PASSWORD"), role: Role.ADMIN, name: "Nahid for Football" },
  { email: "nahidhasankiran@gmail.com", password: required("SEED_USER_PASSWORD"), role: Role.USER, name: "Nahid Hasan Kiran" },
];

async function ensureUser(seed: SeedUser): Promise<"created" | "updated"> {
  let user = await prisma.user.findUnique({ where: { email: seed.email } });
  let result: "created" | "updated" = "updated";

  if (!user) {
    await auth.api.signUpEmail({
      body: { name: seed.name, email: seed.email, password: seed.password },
      headers: new Headers({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000" }),
    });
    user = await prisma.user.findUniqueOrThrow({ where: { email: seed.email } });
    result = "created";
  }

  const password = await hashPassword(seed.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: seed.role, name: seed.name } }),
    prisma.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password } }),
  ]);
  return result;
}

try {
  for (const user of users) {
    const result = await ensureUser(user);
    console.log(`Seeded ${user.email} (${result}, role ${user.role})`);
  }
} finally {
  await prisma.$disconnect();
}
