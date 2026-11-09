import "server-only";
import { db, BUCKET } from "@/lib/supabase/admin";
import { scoreImage } from "@/lib/ai/score";
import { buildLeaderboard, pickWinner, rankPhotos } from "@/lib/ranking";
import type { EventRow, GuestRow, PhotoRow } from "@/lib/types";

export async function getEvent(): Promise<EventRow> {
  const { data, error } = await db().from("event").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as EventRow;
}

export async function getGuests(): Promise<GuestRow[]> {
  const { data, error } = await db().from("guests").select("*").order("name");
  if (error) throw error;
  return data as GuestRow[];
}

/** Fotos visibles. Las eliminadas por el admin quedan fuera salvo `includeDeleted`. */
export async function getPhotos(opts?: { includeDeleted?: boolean }): Promise<PhotoRow[]> {
  let q = db().from("photos").select("*").order("created_at");
  if (!opts?.includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data as PhotoRow[];
}

export async function getLeaderboard() {
  const [event, guests, photos] = await Promise.all([getEvent(), getGuests(), getPhotos()]);
  return { event, board: buildLeaderboard(guests, photos, event.min_photos_for_winner), photos, guests };
}

export async function signedUrls(paths: string[], opts?: { download?: boolean }) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrls(paths, 60 * 60 * 24, opts?.download ? { download: true } : undefined);
  if (error) throw error;
  for (const d of data) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

/** Califica una foto con IA. Seguro de llamar varias veces (reclama la foto antes). */
export async function scorePhoto(photoId: string): Promise<void> {
  const { data: claimed } = await db()
    .from("photos")
    .update({ status: "scoring", error: null })
    .eq("id", photoId)
    .in("status", ["pending", "failed"])
    .select("*")
    .maybeSingle();
  if (!claimed) return; // ya calificada o en proceso
  const photo = claimed as PhotoRow;

  try {
    const { data: blob, error } = await db().storage.from(BUCKET).download(photo.storage_path);
    if (error || !blob) throw new Error(`No se pudo leer la foto: ${error?.message}`);
    const mediaType = (["image/jpeg", "image/png", "image/webp"].includes(blob.type) ? blob.type : "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp";
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const r = await scoreImage(b64, mediaType);
    await db()
      .from("photos")
      .update({
        status: "scored",
        score: r.score,
        fine_score: r.fine_score,
        ai_reason: r.reason,
        ai_provider: r.provider,
      })
      .eq("id", photoId)
      .eq("manual_override", false);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Error calificando", photoId, message);
    await db().from("photos").update({ status: "failed", error: message.slice(0, 500) }).eq("id", photoId);
  }
}

/** Calcula ganador y top al terminar el evento. */
export async function computeResults() {
  const { event, board, photos } = await getLeaderboard();
  const winner = pickWinner(board);
  const top = rankPhotos(photos).slice(0, event.top_count);
  return { event, board, winner, topIds: top.map((p) => p.id) };
}
