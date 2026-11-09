"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, startPolling } from "@/lib/api";
import { Header } from "@/components/Header";
import { Leaderboard } from "@/components/Leaderboard";
import type { LeaderboardEntry } from "@/lib/types";

type Data = {
  event: { status: string; coupleNames: string; minPhotos: number };
  board: LeaderboardEntry[];
  totalPhotos: number;
};

export default function Ranking() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    api<{ meId: string | null }>("/api/guests").then((g) => setMeId(g.meId)).catch(() => {});
    return startPolling(() => {
      api<Data>("/api/leaderboard")
        .then((d) => (d.event.status === "ended" ? router.replace("/resultados") : setData(d)))
        .catch(() => {});
    }, 10000);
  }, [router]);

  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 pb-10">
      <Header coupleNames={data?.event.coupleNames} subtitle="Ranking de fotógrafos en vivo" />
      {data ? (
        <>
          <p className="text-center text-sm text-muted mb-3">
            {data.totalPhotos} fotos tomadas · para ganar se necesitan al menos {data.event.minPhotos} fotos calificadas
          </p>
          <Leaderboard board={data.board} minPhotos={data.event.minPhotos} highlightId={meId} />
        </>
      ) : (
        <p className="text-center text-muted shimmer mt-10">Cargando…</p>
      )}
      <Link href="/camara" className="btn btn-gold mt-8 self-center">
        📸 Seguir tomando fotos
      </Link>
    </main>
  );
}
