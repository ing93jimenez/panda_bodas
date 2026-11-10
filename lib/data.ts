import "server-only";
import { db, BUCKET } from "@/lib/supabase/admin";
import { scoreImage } from "@/lib/ai/score";
import type { ImageData, MediaType, RefPerson } from "@/lib/ai/prompt";
import { buildLeaderboard, pickWinner, rankPhotos } from "@/lib/ranking";
import type { ChallengeRow, EventRow, GuestRow, PersonRow, PhotoRow } from "@/lib/types";

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

export async function getChallenges(opts?: { activeOnly?: boolean }): Promise<ChallengeRow[]> {
  let q = db().from("challenges").select("id,title,bonus,sort,active").order("sort").order("created_at");
  if (opts?.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, bonus: Number(c.bonus) })) as ChallengeRow[];
}

export async function getLeaderboard() {
  const [event, guests, photos, challenges] = await Promise.all([getEvent(), getGuests(), getPhotos(), getChallenges()]);
  const bonus = new Map(challenges.map((c) => [c.id, c.bonus]));
  return {
    event,
    board: buildLeaderboard(guests, photos, event.min_photos_for_winner, bonus),
    photos,
    guests,
    challenges,
  };
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

async function downloadImage(path: string): Promise<ImageData> {
  const { data: blob, error } = await db().storage.from(BUCKET).download(path);
  if (error || !blob) throw new Error(`No se pudo leer la imagen: ${error?.message}`);
  const mediaType = (["image/jpeg", "image/png", "image/webp"].includes(blob.type) ? blob.type : "image/jpeg") as MediaType;
  return { b64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mediaType };
}

export async function getPeople(): Promise<PersonRow[]> {
  const { data, error } = await db().from("people").select("*").order("sort").order("created_at");
  if (error) throw error;
  return data as PersonRow[];
}

// Las fotos de referencia casi no cambian: se guardan en memoria del servidor.
const refCache = new Map<string, ImageData>();

async function getRefs(): Promise<RefPerson[]> {
  const people = await getPeople();
  const refs: RefPerson[] = [];
  for (const p of people) {
    let img = refCache.get(p.photo_path);
    if (!img) {
      try {
        img = await downloadImage(p.photo_path);
        refCache.set(p.photo_path, img);
      } catch {
        continue; // una referencia rota no debe impedir calificar
      }
    }
    refs.push({ ...img, name: p.name, role: p.role });
  }
  return refs;
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
    const [image, refs, event] = await Promise.all([downloadImage(photo.storage_path), getRefs(), getEvent()]);
    let challenge: string | undefined;
    if (photo.challenge_id) {
      const { data: c } = await db().from("challenges").select("title").eq("id", photo.challenge_id).maybeSingle();
      challenge = c?.title;
    }
    const r = await scoreImage({ image, refs, challenge, context: event.ai_context });
    const update: Record<string, unknown> = {
      status: "scored",
      ai_provider: r.provider,
      people: r.people_present,
    };
    if (!photo.manual_override) Object.assign(update, { score: r.score, fine_score: r.fine_score, ai_reason: r.reason });
    if (challenge && !photo.challenge_manual) update.challenge_ok = r.challenge_met;
    await db().from("photos").update(update).eq("id", photoId);
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
