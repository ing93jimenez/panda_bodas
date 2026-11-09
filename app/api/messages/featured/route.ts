import { connection } from "next/server";
import { getGuests } from "@/lib/data";
import { getMessages } from "@/lib/messages";
import { ok } from "@/lib/http";

/** Dedicatorias destacadas por los novios (solo texto) para el proyector y los resultados. */
export async function GET() {
  await connection();
  const [msgs, guests] = await Promise.all([getMessages({ featuredOnly: true }), getGuests()]);
  const names = new Map(guests.map((g) => [g.id, g.name]));
  return ok({
    messages: msgs.filter((m) => m.body).map((m) => ({ id: m.id, name: names.get(m.guest_id) ?? "", body: m.body })),
  });
}
