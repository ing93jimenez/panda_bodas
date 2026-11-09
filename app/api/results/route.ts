import { connection } from "next/server";
import { getLeaderboard, signedUrls } from "@/lib/data";
import { fail, ok } from "@/lib/http";
import { isAdmin } from "@/lib/auth";


/** Resultados: solo disponibles cuando el evento terminó (o para el admin). */
export async function GET() {
  await connection();
  const { event, board, photos, guests } = await getLeaderboard();
  if (event.status !== "ended" && !(await isAdmin())) return fail("Los resultados aún no se revelan", 403);

  const byId = new Map(photos.map((p) => [p.id, p]));
  const names = new Map(guests.map((g) => [g.id, g.name]));
  const top = event.top_photo_ids.map((id) => byId.get(id)).filter((p) => !!p);
  const paths = top.map((p) => p.storage_path);
  const [view, dl] = await Promise.all([signedUrls(paths), signedUrls(paths, { download: true })]);

  let video: { url: string; downloadUrl: string } | null = null;
  if (event.video_path) {
    const [v, vd] = await Promise.all([
      signedUrls([event.video_path]),
      signedUrls([event.video_path], { download: true }),
    ]);
    video = { url: v.get(event.video_path)!, downloadUrl: vd.get(event.video_path)! };
  }

  const winner = board.find((b) => b.guestId === event.winner_guest_id) ?? null;
  return ok({
    event: { status: event.status, coupleNames: event.couple_names, eventDate: event.event_date, minPhotos: event.min_photos_for_winner },
    winner,
    board,
    top: top.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      score: p.score,
      photographer: names.get(p.guest_id) ?? "",
      url: view.get(p.storage_path),
      downloadUrl: dl.get(p.storage_path),
      width: p.width,
      height: p.height,
    })),
    video,
  });
}
