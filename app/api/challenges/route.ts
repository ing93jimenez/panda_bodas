import { connection } from "next/server";
import { db } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { getChallenges } from "@/lib/data";
import { ok } from "@/lib/http";

export type ChallengeStatus = "done" | "checking" | "missed" | null;

/** Retos activos y, si hay invitado, cómo va en cada uno. */
export async function GET() {
  await connection();
  const [challenges, me] = await Promise.all([getChallenges({ activeOnly: true }), currentGuest()]);
  const status = new Map<string, ChallengeStatus>();
  if (me && challenges.length) {
    const { data } = await db()
      .from("photos")
      .select("challenge_id,challenge_ok,status")
      .eq("guest_id", me.id)
      .is("deleted_at", null)
      .not("challenge_id", "is", null);
    for (const p of data ?? []) {
      const prev = status.get(p.challenge_id);
      const now: ChallengeStatus = p.challenge_ok ? "done" : p.challenge_ok === false ? "missed" : "checking";
      // done > checking > missed
      const rank = { done: 3, checking: 2, missed: 1 } as const;
      if (!prev || rank[now!] > rank[prev]) status.set(p.challenge_id, now);
    }
  }
  return ok({
    challenges: challenges.map((c) => ({ id: c.id, title: c.title, bonus: c.bonus, status: status.get(c.id) ?? null })),
  });
}
