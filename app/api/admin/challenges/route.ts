import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getChallenges } from "@/lib/data";
import { fail, ok } from "@/lib/http";

const Create = z.object({
  titles: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  bonus: z.number().min(0).max(1).optional(),
});
const Update = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  bonus: z.number().min(0).max(1).optional(),
  active: z.boolean().optional(),
});
const Remove = z.object({ id: z.uuid() });

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [challenges, { data: photos }] = await Promise.all([
    getChallenges(),
    db().from("photos").select("challenge_id,challenge_ok,guest_id").is("deleted_at", null).not("challenge_id", "is", null),
  ]);
  const stats = new Map<string, { attempts: number; done: Set<string> }>();
  for (const p of photos ?? []) {
    const s = stats.get(p.challenge_id) ?? { attempts: 0, done: new Set<string>() };
    s.attempts++;
    if (p.challenge_ok) s.done.add(p.guest_id);
    stats.set(p.challenge_id, s);
  }
  return ok({
    challenges: challenges.map((c) => ({
      ...c,
      attempts: stats.get(c.id)?.attempts ?? 0,
      completedBy: stats.get(c.id)?.done.size ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { count } = await db().from("challenges").select("id", { count: "exact", head: true });
  const rows = parsed.data.titles.map((title, i) => ({
    title,
    bonus: parsed.data.bonus ?? 0.1,
    sort: (count ?? 0) + i,
  }));
  const { error } = await db().from("challenges").insert(rows);
  if (error) return fail(error.message, 500);
  return ok({ added: rows.length });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { id, ...rest } = parsed.data;
  const { error } = await db().from("challenges").update(rest).eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  // Las fotos que lo tenían quedan sin reto (no se borran).
  const { error } = await db().from("challenges").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
