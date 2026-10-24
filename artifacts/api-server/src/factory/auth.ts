import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, factorySessions, factoryUsers } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { DomainError, requireRule, type Actor } from "./domain";

const scrypt = promisify(scryptCallback);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const random = () => randomBytes(32).toString("hex");
const COOKIE = "forgeflow_session";
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
async function checkPassword(password: string, encoded: string) {
  const [, salt, key] = encoded.split(":");
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export type Session = typeof factorySessions.$inferSelect;
declare global {
  namespace Express {
    interface Request { factorySession?: Session; factoryUser?: Actor; }
  }
}
function cookieOptions(req: Request) {
  return {
    httpOnly: true, sameSite: "strict" as const, path: "/api/factory",
    secure: process.env.NODE_ENV === "production" || req.secure || req.get("x-forwarded-proto") === "https",
    maxAge: 8 * 60 * 60 * 1000,
  };
}
export async function newSession(req: Request, res: Response, userId?: string) {
  const token = random();
  const row: Session = { tokenHash: digest(token), userId: userId ?? null, csrfToken: random(), expiresAt: new Date(Date.now() + 8 * 3600000) };
  await db.transaction(async tx => {
    if (req.factorySession) await tx.delete(factorySessions).where(eq(factorySessions.tokenHash, req.factorySession.tokenHash));
    await tx.insert(factorySessions).values(row);
  });
  res.cookie(COOKIE, token, cookieOptions(req));
  req.factorySession = row;
  return row;
}
export async function sessionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.set("Cache-Control", "no-store");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  const token = req.cookies?.[COOKIE];
  if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
    const [session] = await db.select().from(factorySessions).where(and(eq(factorySessions.tokenHash, digest(token)), gt(factorySessions.expiresAt, new Date())));
    req.factorySession = session;
    if (session?.userId) {
      const [user] = await db.select().from(factoryUsers).where(eq(factoryUsers.id, session.userId));
      if (user) req.factoryUser = { id: user.id, name: user.name, email: user.email, role: user.role as Actor["role"] };
    }
  }
  next();
}
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.factoryUser) throw new DomainError(401, "Please sign in to ForgeFlow.");
  next();
}
export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  requireRule(req.get("sec-fetch-site") !== "cross-site", "Cross-site requests are not allowed.", 403);
  const expected = req.factorySession?.csrfToken;
  const supplied = req.get("x-factory-csrf");
  requireRule(expected && supplied && /^[a-f0-9]{64}$/.test(supplied) && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)), "Your session security token is missing or expired. Refresh and try again.", 403);
  next();
}
// Per-process bounded throttle also covers unknown accounts; credentials never enter logs.
const attempts = new Map<string, { count: number; until: number }>();
export async function login(req: Request, res: Response, email: string, password: string) {
  const key = `${req.ip}:${email.toLowerCase()}`;
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 10) throw new DomainError(429, "Too many sign-in attempts. Try again in 15 minutes.");
  if (attempts.size > 2000) for (const [k, value] of attempts) if (value.until < Date.now()) attempts.delete(k);
  requireRule(attempts.size < 5000 || attempts.has(key), "Sign-in is busy. Try again shortly.", 429);
  const [user] = await db.select().from(factoryUsers).where(eq(factoryUsers.email, email.trim().toLowerCase()));
  // Same expensive password derivation whether or not an account exists.
  const encoded = user?.passwordHash ?? "scrypt:00000000000000000000000000000000:" + "0".repeat(128);
  const valid = await checkPassword(password, encoded);
  if (!user || !valid) {
    attempts.set(key, { count: entry && entry.until > Date.now() ? entry.count + 1 : 1, until: entry?.until && entry.until > Date.now() ? entry.until : Date.now() + 900000 });
    throw new DomainError(401, "Email or password is incorrect.");
  }
  attempts.delete(key);
  const session = await newSession(req, res, user.id);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role as Actor["role"] }, csrfToken: session.csrfToken };
}
export async function logout(req: Request, res: Response) {
  if (req.factorySession) await db.delete(factorySessions).where(eq(factorySessions.tokenHash, req.factorySession.tokenHash));
  res.clearCookie(COOKIE, { path: "/api/factory", httpOnly: true, sameSite: "strict" });
}
