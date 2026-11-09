import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { currentGuest, newDeviceToken, setGuestCookie } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

const Body = z.object({ guestId: z.uuid() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invitado inválido");
  const { guestId } = parsed.data;

  const me = await currentGuest();
  if (me?.id === guestId) return ok({ guest: { id: me.id, name: me.name } });
  if (me) return fail(`Este celular ya está registrado como ${me.name}`, 409);

  const token = newDeviceToken();
  const { data } = await db()
    .from("guests")
    .update({ device_token: token, claimed_at: new Date().toISOString() })
    .eq("id", guestId)
    .is("device_token", null)
    .select("id,name")
    .maybeSingle();
  if (!data) return fail("Ese nombre ya fue elegido desde otro celular. Pídele a los novios que lo liberen.", 409);

  await setGuestCookie(token);
  return ok({ guest: data });
}
