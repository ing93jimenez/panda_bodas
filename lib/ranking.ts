import type { GuestRow, LeaderboardEntry, PhotoRow } from "./types";

type GuestLite = Pick<GuestRow, "id" | "name">;
type PhotoLite = Pick<PhotoRow, "id" | "guest_id" | "score" | "fine_score" | "created_at">;

/**
 * Ranking de fotógrafos: promedio de estrellas de sus fotos calificadas.
 * Solo es elegible quien tiene al menos `minPhotos` fotos calificadas.
 * Orden: elegibles primero, luego promedio desc, luego nº de fotos desc, luego nombre.
 */
export function buildLeaderboard(
  guests: GuestLite[],
  photos: PhotoLite[],
  minPhotos: number,
): LeaderboardEntry[] {
  const byGuest = new Map<string, { total: number; scored: number; sum: number }>();
  for (const p of photos) {
    const s = byGuest.get(p.guest_id) ?? { total: 0, scored: 0, sum: 0 };
    s.total++;
    if (p.score != null) {
      s.scored++;
      s.sum += p.score;
    }
    byGuest.set(p.guest_id, s);
  }

  return guests
    .map((g) => {
      const s = byGuest.get(g.id) ?? { total: 0, scored: 0, sum: 0 };
      const average = s.scored ? Math.round((s.sum / s.scored) * 100) / 100 : null;
      return {
        guestId: g.id,
        name: g.name,
        photos: s.total,
        scored: s.scored,
        average,
        eligible: s.scored >= minPhotos,
      };
    })
    .filter((e) => e.photos > 0)
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        (b.average ?? 0) - (a.average ?? 0) ||
        b.scored - a.scored ||
        a.name.localeCompare(b.name, "es"),
    );
}

export function pickWinner(board: LeaderboardEntry[]): LeaderboardEntry | null {
  const first = board[0];
  return first && first.eligible ? first : null;
}

/** Mejores fotos: estrellas desc, luego puntaje fino desc, luego la más antigua. */
export function rankPhotos<T extends PhotoLite>(photos: T[]): T[] {
  return photos
    .filter((p) => p.score != null)
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        (b.fine_score ?? 0) - (a.fine_score ?? 0) ||
        a.created_at.localeCompare(b.created_at),
    );
}
