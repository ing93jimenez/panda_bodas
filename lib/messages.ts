import "server-only";
import { db } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/data";
import type { MessageRow } from "@/lib/types";

export const AUDIO_EXT: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
};

export async function getMessages(opts: { guestId?: string; featuredOnly?: boolean; includeDeleted?: boolean } = {}) {
  let q = db().from("messages").select("*").order("created_at", { ascending: false });
  if (opts.guestId) q = q.eq("guest_id", opts.guestId);
  if (opts.featuredOnly) q = q.eq("featured", true);
  if (!opts.includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data as MessageRow[];
}

/** Agrega URLs firmadas de audio (reproducir y descargar). */
export async function withAudio(messages: MessageRow[]) {
  const paths = messages.map((m) => m.audio_path).filter((p): p is string => !!p);
  const [play, dl] = await Promise.all([signedUrls(paths), signedUrls(paths, { download: true })]);
  return messages.map((m) => ({
    ...m,
    audioUrl: m.audio_path ? (play.get(m.audio_path) ?? null) : null,
    audioDownloadUrl: m.audio_path ? (dl.get(m.audio_path) ?? null) : null,
  }));
}
