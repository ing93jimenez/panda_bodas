import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLeaderboard, getPhotos, signedUrls } from "@/lib/data";
import { rankPhotos } from "@/lib/ranking";
import { ok } from "@/lib/http";


export async function GET() {
  await connection();
  const denied = await requireAdmin();
  if (denied) return denied;
  const [{ event, board, photos, guests, challenges }, allPhotos] = await Promise.all([
    getLeaderboard(),
    getPhotos({ includeDeleted: true }),
  ]);
  const urls = await signedUrls(allPhotos.map((p) => p.storage_path));
  const names = new Map(guests.map((g) => [g.id, g.name]));
  const counts = new Map<string, number>();
  for (const p of photos) counts.set(p.guest_id, (counts.get(p.guest_id) ?? 0) + 1);
  const hasAny = new Set(allPhotos.map((p) => p.guest_id));
  const challengeTitles = new Map(challenges.map((c) => [c.id, c.title]));

  const ranked = rankPhotos(photos);
  const rankIndex = new Map(ranked.map((p, i) => [p.id, i + 1]));
  const video = event.video_path ? (await signedUrls([event.video_path])).get(event.video_path) : null;

  return ok({
    event,
    videoUrl: video ?? null,
    board,
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      claimed: !!g.device_token,
      photos: counts.get(g.id) ?? 0,
      canDelete: !hasAny.has(g.id),
    })),
    photos: allPhotos
      .map((p) => ({
        id: p.id,
        photographer: names.get(p.guest_id) ?? "",
        guestId: p.guest_id,
        url: urls.get(p.storage_path) ?? null,
        status: p.status,
        score: p.score,
        fineScore: p.fine_score,
        reason: p.ai_reason,
        provider: p.ai_provider,
        manual: p.manual_override,
        error: p.error,
        width: p.width,
        height: p.height,
        createdAt: p.created_at,
        rank: rankIndex.get(p.id) ?? null,
        deleted: !!p.deleted_at,
        people: p.people ?? [],
        challenge: p.challenge_id
          ? { title: challengeTitles.get(p.challenge_id) ?? "", ok: p.challenge_ok, manual: p.challenge_manual }
          : null,
      }))
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.createdAt.localeCompare(a.createdAt)),
    stats: {
      total: photos.length,
      deleted: allPhotos.length - photos.length,
      pending: photos.filter((p) => p.status === "pending" || p.status === "scoring").length,
      failed: photos.filter((p) => p.status === "failed").length,
      byProvider: {
        claude: photos.filter((p) => p.ai_provider === "claude").length,
        gemini: photos.filter((p) => p.ai_provider === "gemini").length,
      },
    },
  });
}
