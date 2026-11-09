"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, startPolling } from "@/lib/api";
import type { Results } from "@/lib/results";
import { Header } from "@/components/Header";
import { Leaderboard } from "@/components/Leaderboard";
import { Stars } from "@/components/Stars";

export default function Resultados() {
  const router = useRouter();
  const [data, setData] = useState<Results | null>(null);
  const [open, setOpen] = useState<Results["top"][number] | null>(null);

  useEffect(
    () =>
      startPolling(() => {
        api<Results>("/api/results")
          .then(setData)
          .catch((e) => e instanceof ApiError && e.status === 403 && router.replace("/camara"));
      }, 30000),
    [router],
  );

  if (!data) return <p className="text-center text-muted shimmer mt-20">Preparando la revelación…</p>;

  return (
    <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pb-16">
      <Header coupleNames={data.event.coupleNames} subtitle="¡Gracias por capturar nuestro gran día!" />

      <section className="card p-6 text-center fade-up">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Mejor fotógrafo de la noche</p>
        {data.winner ? (
          <>
            <p className="text-5xl mt-3">🏆</p>
            <p className="title text-4xl font-semibold mt-2">{data.winner.name}</p>
            <Stars value={data.winner.average} className="text-2xl" />
            <p className="text-muted text-sm mt-1">
              Promedio {data.winner.average?.toFixed(2)} ★ en {data.winner.scored} fotos
            </p>
          </>
        ) : (
          <p className="text-muted mt-3">Nadie alcanzó el mínimo de {data.event.minPhotos} fotos calificadas.</p>
        )}
      </section>

      {data.video && (
        <section className="mt-8 fade-up">
          <h2 className="title text-3xl font-semibold text-center mb-3">El video</h2>
          <video src={data.video.url} controls playsInline className="w-full rounded-2xl bg-black" />
          <a href={data.video.downloadUrl} className="btn btn-gold w-full mt-3">
            ⬇️ Descargar video
          </a>
        </section>
      )}

      {data.top.length > 0 && (
        <section className="mt-10">
          <h2 className="title text-3xl font-semibold text-center mb-4">Las {data.top.length} mejores fotos</h2>
          <div className="grid grid-cols-2 gap-3">
            {data.top.map((p) => (
              <button key={p.id} className="card overflow-hidden text-left" onClick={() => setOpen(p)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Foto de ${p.photographer}`} className="w-full aspect-square object-cover" loading="lazy" />
                <div className="p-2">
                  <p className="text-xs text-muted">#{p.rank} · {p.photographer}</p>
                  <Stars value={p.score} className="text-sm" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="title text-3xl font-semibold text-center mb-4">Ranking final</h2>
        <Leaderboard board={data.board} minPhotos={data.event.minPhotos} highlightId={data.winner?.guestId} />
      </section>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt="" className="max-h-[75vh] max-w-full rounded-xl" />
          <p className="text-white mt-3">
            #{open.rank} · 📷 {open.photographer} · <Stars value={open.score} />
          </p>
          <a href={open.downloadUrl} className="btn btn-gold mt-3" onClick={(e) => e.stopPropagation()}>
            ⬇️ Descargar foto
          </a>
        </div>
      )}
    </main>
  );
}
