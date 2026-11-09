import type { LeaderboardEntry } from "@/lib/types";
import { Stars } from "./Stars";

export function Leaderboard({
  board,
  minPhotos,
  highlightId,
  big = false,
}: {
  board: LeaderboardEntry[];
  minPhotos: number;
  highlightId?: string | null;
  big?: boolean;
}) {
  if (!board.length)
    return <p className={`text-center text-muted ${big ? "text-3xl" : ""}`}>Aún no hay fotos calificadas. ¡A disparar!</p>;
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <ol className={`flex flex-col ${big ? "gap-4" : "gap-2"}`}>
      {board.map((e, i) => (
        <li
          key={e.guestId}
          className={`card flex items-center ${big ? "gap-6 px-8 py-5" : "gap-3 px-4 py-3"} ${
            e.guestId === highlightId ? "ring-2 ring-gold" : ""
          } ${e.eligible ? "" : "opacity-60"}`}
        >
          <span className={`w-8 text-center ${big ? "text-4xl w-14" : "text-xl"}`}>
            {e.eligible && i < 3 ? medal[i] : <span className="text-muted text-base">{i + 1}</span>}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold truncate ${big ? "text-3xl" : ""}`}>{e.name}</p>
            <p className={`text-muted ${big ? "text-xl" : "text-xs"}`}>
              {e.photos} {e.photos === 1 ? "foto" : "fotos"}
              {e.challenges > 0 && ` · 🎯 ${e.challenges} ${e.challenges === 1 ? "reto" : "retos"}`}
              {!e.eligible && ` · necesita ${minPhotos} calificadas`}
            </p>
          </div>
          <div className="text-right">
            <Stars value={e.average} className={big ? "text-3xl" : "text-base"} />
            <p className={`text-muted ${big ? "text-xl" : "text-xs"}`}>
              {e.total == null ? "—" : e.bonus > 0 ? (
                <>
                  {e.average?.toFixed(2)} + 🎯{e.bonus.toFixed(2)} = <b className="text-gold-dark">{e.total.toFixed(2)}</b>
                </>
              ) : (
                e.total.toFixed(2)
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
