import { pinMatches, setAdminCookie } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  await new Promise((r) => setTimeout(r, 400)); // frena intentos por fuerza bruta
  if (!pinMatches(pin)) return fail("PIN incorrecto", 401);
  await setAdminCookie();
  return ok({ ok: true });
}
