import { clearAdminCookie } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  await clearAdminCookie();
  return ok({ ok: true });
}
