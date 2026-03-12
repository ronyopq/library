import { and, eq, gt, ne, sql } from "drizzle-orm";
import type { CreateStaffUserInput, LoginInput, ResetStaffPasswordInput, UpdateStaffUserInput } from "@shared/schemas";
import type { AuthUser } from "@shared/types";
import type { DbClient } from "../db/client";
import type { Env } from "../env";
import { authSessions, users } from "../db/schema";
import { normalizeKey, normalizeUnicode } from "../utils/text";
import { logActivity } from "./activityService";

const PBKDF2_PREFIX = "pbkdf2";
const DEFAULT_ITERATIONS = 100000;
const SESSION_TTL_DAYS = 30;

const defaultStaffSeeds: Array<{
  username: string;
  fullName: string;
  phone: string;
  role: "admin" | "librarian";
  password: string;
}> = [
  {
    username: "ronysiddiqi",
    fullName: "Rony Siddiqi",
    phone: "",
    role: "admin",
    password: "120174"
  }
];

const textEncoder = new TextEncoder();

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const deriveHash = async (password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> => {
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(password), { name: "PBKDF2" }, false, [
    "deriveBits"
  ]);

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
};

const secureCompare = (left: Uint8Array, right: Uint8Array): boolean => {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
};

export const createPasswordHash = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveHash(password, salt, DEFAULT_ITERATIONS);
  return `${PBKDF2_PREFIX}$${DEFAULT_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [prefix, iterationsRaw, saltEncoded, hashEncoded] = storedHash.split("$");
  if (!prefix || !iterationsRaw || !saltEncoded || !hashEncoded) return false;
  if (prefix !== PBKDF2_PREFIX) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 10000) return false;

  const salt = base64ToBytes(saltEncoded);
  const expectedHash = base64ToBytes(hashEncoded);
  const actualHash = await deriveHash(password, salt, iterations);

  return secureCompare(actualHash, expectedHash);
};

const toAuthUser = (row: {
  id: number;
  username: string;
  fullName: string | null;
  phone: string | null;
  role: string;
}): AuthUser => ({
  id: row.id,
  username: row.username,
  fullName: row.fullName ?? undefined,
  phone: row.phone ?? undefined,
  role: row.role === "admin" ? "admin" : "librarian"
});

const generateSessionToken = (): string => `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;

const createSession = async (
  db: DbClient,
  userId: number
): Promise<{
  token: string;
  expiresAt: string;
}> => {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = generateSessionToken();
  const nowIso = now.toISOString();
  const expiryIso = expires.toISOString();

  await db.insert(authSessions).values({
    token,
    userId,
    expiresAt: expiryIso,
    createdAt: nowIso,
    lastSeenAt: nowIso
  });

  return {
    token,
    expiresAt: expiryIso
  };
};

const getTokenFromRequest = (request: Request, queryToken?: string | null): string | null => {
  const authHeader = request.headers.get("x-auth-token");
  if (authHeader?.trim()) return authHeader.trim();

  const legacyHeader = request.headers.get("x-admin-token");
  if (legacyHeader?.trim()) return legacyHeader.trim();

  if (queryToken?.trim()) return queryToken.trim();
  return null;
};

export const ensureDefaultUsers = async (db: DbClient): Promise<void> => {
  const existingCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
  if (Number(existingCount[0]?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();

  for (const seed of defaultStaffSeeds) {
    const passwordHash = await createPasswordHash(seed.password);
    await db.insert(users).values({
      username: seed.username,
      usernameNormalized: normalizeKey(seed.username) ?? seed.username.toLowerCase(),
      fullName: seed.fullName,
      phone: seed.phone,
      role: seed.role,
      passwordHash,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  }
};

const getActiveAdminCount = async (db: DbClient): Promise<number> => {
  const rows = await db
    .select({
      count: sql<number>`COUNT(*)`
    })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true)));

  return Number(rows[0]?.count ?? 0);
};

export const loginWithPassword = async (
  db: DbClient,
  input: LoginInput
): Promise<{ token: string; user: AuthUser; expiresAt: string } | null> => {
  await ensureDefaultUsers(db);

  const usernameKey = normalizeKey(input.username);
  if (!usernameKey) return null;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      passwordHash: users.passwordHash,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.usernameNormalized, usernameKey))
    .limit(1);

  const target = rows[0];
  if (!target || !target.isActive) {
    return null;
  }

  const ok = await verifyPassword(input.password, target.passwordHash);
  if (!ok) {
    return null;
  }

  const session = await createSession(db, target.id);
  await db
    .update(users)
    .set({
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, target.id));

  await logActivity(db, {
    entityType: "auth",
    entityId: `${target.id}`,
    action: "staff_login",
    message: `Staff login successful for ${target.username}`,
    payload: {
      role: target.role
    }
  });

  return {
    token: session.token,
    user: toAuthUser(target),
    expiresAt: session.expiresAt
  };
};

export const resolveAuthUser = async (
  db: DbClient,
  env: Env,
  request: Request,
  queryToken?: string | null
): Promise<AuthUser | null> => {
  const provided = getTokenFromRequest(request, queryToken);
  if (!provided) return null;

  if (env.ADMIN_TOKEN && provided === env.ADMIN_TOKEN) {
    return {
      id: 0,
      username: "system-admin-token",
      fullName: "System Admin",
      role: "admin"
    };
  }

  const now = new Date().toISOString();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.token, provided), gt(authSessions.expiresAt, now), eq(users.isActive, true)))
    .limit(1);

  const found = rows[0];
  if (!found) {
    return null;
  }

  await db
    .update(authSessions)
    .set({
      lastSeenAt: now
    })
    .where(eq(authSessions.token, provided));

  return toAuthUser(found);
};

export const logoutByToken = async (db: DbClient, request: Request, queryToken?: string | null): Promise<void> => {
  const provided = getTokenFromRequest(request, queryToken);
  if (!provided) return;

  await db.delete(authSessions).where(eq(authSessions.token, provided));
};

export const listStaffUsers = async (db: DbClient): Promise<AuthUser[]> => {
  await ensureDefaultUsers(db);

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.username);

  return rows.map(toAuthUser);
};

export const createStaffUser = async (
  db: DbClient,
  input: CreateStaffUserInput,
  actor?: AuthUser
): Promise<AuthUser> => {
  const username = normalizeUnicode(input.username);
  const usernameNormalized = normalizeKey(input.username);
  if (!username || !usernameNormalized) {
    throw new Error("Username is required.");
  }

  const existing = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(eq(users.usernameNormalized, usernameNormalized))
    .limit(1);

  if (existing[0]) {
    throw new Error("Username already exists.");
  }

  const now = new Date().toISOString();
  const passwordHash = await createPasswordHash(input.password);

  const inserted = await db
    .insert(users)
    .values({
      username,
      usernameNormalized,
      fullName: normalizeUnicode(input.fullName),
      phone: normalizeUnicode(input.phone),
      role: input.role,
      passwordHash,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .returning({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role
    });

  const created = inserted[0];

  await logActivity(db, {
    entityType: "user",
    entityId: `${created.id}`,
    action: "staff_created",
    message: `Staff user created (${created.username})`,
    payload: {
      role: created.role,
      createdBy: actor?.username ?? "system"
    }
  });

  return toAuthUser(created);
};

export const updateStaffUser = async (
  db: DbClient,
  userId: number,
  input: UpdateStaffUserInput,
  actor?: AuthUser
): Promise<AuthUser | null> => {
  await ensureDefaultUsers(db);

  const targetRows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const target = targetRows[0];
  if (!target || !target.isActive) {
    return null;
  }

  const username = normalizeUnicode(input.username);
  const usernameNormalized = normalizeKey(input.username);
  if (!username || !usernameNormalized) {
    throw new Error("Username is required.");
  }

  const existing = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(and(eq(users.usernameNormalized, usernameNormalized), ne(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  if (existing[0]) {
    throw new Error("Username already exists.");
  }

  if (target.role === "admin" && input.role !== "admin") {
    const adminCount = await getActiveAdminCount(db);
    if (adminCount <= 1) {
      throw new Error("At least one active admin account is required.");
    }
  }

  const now = new Date().toISOString();
  const updatedRows = await db
    .update(users)
    .set({
      username,
      usernameNormalized,
      fullName: normalizeUnicode(input.fullName),
      phone: normalizeUnicode(input.phone),
      role: input.role,
      updatedAt: now
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role
    });

  const updated = updatedRows[0];

  await logActivity(db, {
    entityType: "user",
    entityId: `${updated.id}`,
    action: "staff_updated",
    message: `Staff user updated (${updated.username})`,
    payload: {
      updatedBy: actor?.username ?? "system",
      previousRole: target.role,
      nextRole: updated.role
    }
  });

  return toAuthUser(updated);
};

export const resetStaffPassword = async (
  db: DbClient,
  userId: number,
  input: ResetStaffPasswordInput,
  actor?: AuthUser
): Promise<boolean> => {
  await ensureDefaultUsers(db);

  const targetRows = await db
    .select({
      id: users.id,
      username: users.username,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const target = targetRows[0];
  if (!target || !target.isActive) {
    return false;
  }

  const passwordHash = await createPasswordHash(input.password);
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, userId));

  await logActivity(db, {
    entityType: "user",
    entityId: `${target.id}`,
    action: "staff_password_reset",
    message: `Staff password reset (${target.username})`,
    payload: {
      updatedBy: actor?.username ?? "system"
    }
  });

  return true;
};

export const deleteStaffUser = async (db: DbClient, userId: number, actor?: AuthUser): Promise<boolean> => {
  await ensureDefaultUsers(db);

  const targetRows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const target = targetRows[0];
  if (!target || !target.isActive) {
    return false;
  }

  if (actor?.id === userId) {
    throw new Error("You cannot delete your own account while signed in.");
  }

  if (target.role === "admin") {
    const adminCount = await getActiveAdminCount(db);
    if (adminCount <= 1) {
      throw new Error("At least one active admin account is required.");
    }
  }

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({
      isActive: false,
      updatedAt: now
    })
    .where(eq(users.id, userId));

  await db.delete(authSessions).where(eq(authSessions.userId, userId));

  await logActivity(db, {
    entityType: "user",
    entityId: `${target.id}`,
    action: "staff_deleted",
    message: `Staff user deleted (${target.username})`,
    payload: {
      role: target.role,
      deletedBy: actor?.username ?? "system"
    }
  });

  return true;
};
