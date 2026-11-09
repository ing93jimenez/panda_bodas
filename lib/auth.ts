import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase/admin";
import type { GuestRow } from "@/lib/types";

export const GUEST_COOKIE = "guest_token";
export const ADMIN_COOKIE = "admin_session";
const YEAR = 60 * 60 * 24 * 365;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function setGuestCookie(token: string) {
  (await cookies()).set(GUEST_COOKIE, token, { ...cookieOpts, maxAge: YEAR });
}

export async function clearGuestCookie() {
  (await cookies()).delete(GUEST_COOKIE);
}

export async function currentGuest(): Promise<GuestRow | null> {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!token) return null;
  const { data } = await db().from("guests").select("*").eq("device_token", token).maybeSingle();
  return (data as GuestRow) ?? null;
}

function adminSignature(): string {
  return createHmac("sha256", `${env.adminPin()}:${env.supabaseSecret()}`).update("admin-v1").digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function pinMatches(pin: string): boolean {
  return safeEqual(pin, env.adminPin());
}

export async function setAdminCookie() {
  (await cookies()).set(ADMIN_COOKIE, adminSignature(), { ...cookieOpts, maxAge: 60 * 60 * 24 * 7 });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!v && safeEqual(v, adminSignature());
}

/** Devuelve una respuesta 401 si no es admin, o null si puede continuar. */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ error: "No autorizado" }, { status: 401 });
}
