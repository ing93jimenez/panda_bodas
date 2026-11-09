"use client";

import { useEffect, useRef, useState } from "react";
import { useOrigin } from "@/lib/useOrigin";
import { api, startPolling } from "@/lib/api";
import type { Results } from "@/lib/results";
import type { LeaderboardEntry } from "@/lib/types";
import { Leaderboard } from "@/components/Leaderboard";
import { QR } from "@/components/QR";
import { Stars } from "@/components/Stars";
import { MessageTicker, useFeaturedMessages } from "@/components/FeaturedMessages";

type Live = {
  event: { status: string; coupleNames: string; minPhotos: number };
  board: LeaderboardEntry[];
  totalPhotos: number;
};
type Stage = "live" | "drumroll" | "winner" | "video" | "gallery";

export default function Proyector() {
  const [live, setLive] = useState<Live | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [stage, setStage] = useState<Stage>("live");
  const [slide, setSlide] = useState(0);
  const origin = useOrigin();
  const started = useRef(false);
  const messages = useFeaturedMessages();


  useEffect(
    () =>
      startPolling(() => {
        api<Live>("/api/leaderboard")
          .then(async (d) => {
            setLive(d);
            if (d.event.status === "ended") {
              const r = await api<Results>("/api/results");
              setResults(r);
              if (!started.current) {
                started.current = true;
                setStage("drumroll");
                setTimeout(() => setStage("winner"), 6000);
              }
            } else {
              started.current = false;
              setResults(null);
              setStage("live");
            }
          })
          .catch(() => {});
      }, 8000),
    [],
  );

  // Galería en bucle
  useEffect(() => {
    if (stage !== "gallery" || !results?.top.length) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % results.top.length), 5000);
    return () => clearInterval(t);
  }, [stage, results]);

  const next = () => {
    if (stage === "winner") setStage(results?.video ? "video" : "gallery");
    else if (stage === "video") setStage("gallery");
    else if (stage === "gallery") setStage("winner");
  };

  return (
    <main
      className="fixed inset-0 bg-ivory flex flex-col cursor-pointer select-none overflow-hidden"
      onClick={next}
      title="Clic para avanzar"
    >
      {stage === "live" && live && (
        <div className="flex-1 grid grid-cols-[1fr_auto] gap-12 p-12">
          <div className="flex flex-col min-h-0">
            <p className="uppercase tracking-[0.4em] text-muted text-xl">Ranking de fotógrafos</p>
            <h1 className="title text-7xl font-semibold mb-6">{live.event.coupleNames}</h1>
            <div className="overflow-hidden flex-1">
              <Leaderboard board={live.board.slice(0, messages.length ? 5 : 8)} minPhotos={live.event.minPhotos} big />
            </div>
            {messages.length > 0 && (
              <div className="card px-10 py-6 mt-6">
                <MessageTicker messages={messages} big />
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-center text-center gap-4 w-[420px]">
            <div className="card p-6">{origin && <QR url={origin} size={340} />}</div>
            <p className="title text-4xl font-semibold">¡Escanea y participa!</p>
            <p className="text-2xl text-muted">
              {live.totalPhotos} fotos tomadas
            </p>
          </div>
        </div>
      )}

      {stage === "drumroll" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-up">
          <p className="text-9xl shimmer">🥁</p>
          <p className="title text-7xl font-semibold mt-8">Y el mejor fotógrafo de la noche es…</p>
        </div>
      )}

      {stage === "winner" && results && (
        <div className="flex-1 flex flex-col items-center justify-center text-center fade-up">
          {results.winner ? (
            <>
              <p className="text-[10rem] leading-none">🏆</p>
              <p className="title text-[7rem] font-semibold leading-tight mt-4">{results.winner.name}</p>
              <Stars value={results.winner.average} className="text-7xl" />
              <p className="text-3xl text-muted mt-4">
                Promedio {results.winner.average?.toFixed(2)} ★ en {results.winner.scored} fotos
              {results.winner.challenges > 0 &&
                ` · 🎯 ${results.winner.challenges} ${results.winner.challenges === 1 ? "reto" : "retos"} (+${results.winner.bonus.toFixed(2)})`}
              </p>
            </>
          ) : (
            <p className="title text-6xl">¡Gracias a todos por sus fotos!</p>
          )}
          <p className="text-muted mt-12 text-xl">Clic para continuar</p>
        </div>
      )}

      {stage === "video" && results?.video && (
        <video
          src={results.video.url}
          autoPlay
          controls={false}
          playsInline
          className="w-full h-full object-contain bg-black"
          onEnded={() => setStage("gallery")}
        />
      )}

      {stage === "gallery" && results && results.top[slide] && (
        <div className="flex-1 relative bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={results.top[slide].id} src={results.top[slide].url} alt="" className="w-full h-full object-contain fade-up" />
          <div className="absolute bottom-0 inset-x-0 p-8 bg-gradient-to-t from-black/80 to-transparent text-white text-center">
            <p className="title text-5xl">#{results.top[slide].rank} · 📷 {results.top[slide].photographer}</p>
            <Stars value={results.top[slide].score} className="text-4xl" />
          </div>
        </div>
      )}

      {!live && <p className="m-auto text-3xl text-muted shimmer">Cargando…</p>}
    </main>
  );
}
