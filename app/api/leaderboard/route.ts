import { connection } from "next/server";
import { getLeaderboard } from "@/lib/data";
import { ok } from "@/lib/http";


/** Ranking público: solo nombres y números, nunca fotos. */
export async function GET() {
  await connection();
  const { event, board } = await getLeaderboard();
  return ok({
    event: {
      status: event.status,
      coupleNames: event.couple_names,
      eventDate: event.event_date,
      minPhotos: event.min_photos_for_winner,
    },
    board,
    totalPhotos: board.reduce((n, e) => n + e.photos, 0),
  });
}
