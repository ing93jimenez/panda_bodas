"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { browserDb } from "@/lib/supabase/browser";
import { buildSegments, estimateDuration, renderVideo, type VideoFormat } from "@/lib/video/render";
import { useFeaturedMessages } from "@/components/FeaturedMessages";
import type { AdminState } from "./types";

function formatDate(d: string | null) {
  if (!d) return undefined;
  return new Date(`${d}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export function VideoMaker({ state, onDone }: { state: AdminState; onDone: () => void }) {
  const ranked = state.photos.filter((p) => p.rank != null && p.url).sort((a, b) => a.rank! - b.rank!);
  const max = Math.min(50, ranked.length);
  const [count, setCount] = useState(Math.min(10, max));
  const [format, setFormat] = useState<VideoFormat>("16:9");
  const [spp, setSpp] = useState(4);
  const [music, setMusic] = useState<File | null>(null);
  const [progress, setProgress] = useState<{ f: number; label: string } | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; mime: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const featured = useFeaturedMessages(60000);
  const [withMessages, setWithMessages] = useState(true);
  const usedMessages = withMessages ? featured : [];
  const segmentCount = buildSegments(Math.min(count, max), usedMessages.length).length;

  const chosen = ranked.slice(0, count);
  const winner = state.board.find((b) => b.guestId === state.event.winner_guest_id)?.name ?? (state.board[0]?.eligible ? state.board[0].name : null);

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const out = await renderVideo({
        // cuenta regresiva: del puesto N al #1
        photos: [...chosen].reverse().map((p) => ({ url: p.url!, photographer: p.photographer, score: p.score, rank: p.rank! })),
        format,
        title: state.event.couple_names,
        subtitle: formatDate(state.event.event_date),
        winnerName: winner,
        music,
        secondsPerPhoto: spp,
        messages: usedMessages.map((m) => ({ name: m.name, body: m.body })),
        canvas: canvasRef.current ?? undefined,
        onProgress: (f, label) => setProgress({ f, label }),
      });
      setResult({ ...out, url: URL.createObjectURL(out.blob) });
      setProgress(null);
    } catch (e) {
      setError((e as Error).message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      setProgress({ f: 0.5, label: "Subiendo video…" });
      const { path, token } = await api<{ path: string; token: string }>("/api/admin/video", {
        method: "POST",
        json: { action: "upload-url", ext: result.ext },
      });
      const { error } = await browserDb()
        .storage.from("media")
        .uploadToSignedUrl(path, token, result.blob, { contentType: result.mime.split(";")[0], upsert: false });
      if (error) throw new Error(error.message);
      await api("/api/admin/video", { method: "POST", json: { action: "publish", path, photoIds: chosen.map((p) => p.id) } });
      setProgress(null);
      onDone();
      alert("¡Video publicado! Los invitados ya lo pueden ver y descargar.");
    } catch (e) {
      setError((e as Error).message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  if (!max) return <p className="text-muted">Aún no hay fotos calificadas para hacer el video.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Cantidad de fotos: {count}</span>
          <input type="range" min={1} max={max} value={count} onChange={(e) => setCount(+e.target.value)} disabled={busy} />
          <span className="text-muted text-xs">Las {count} mejores calificadas (de {ranked.length})</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Segundos por foto: {spp}</span>
          <input type="range" min={2} max={7} value={spp} onChange={(e) => setSpp(+e.target.value)} disabled={busy} />
          <span className="text-muted text-xs">Duración aprox.: {Math.round(estimateDuration(segmentCount, spp))} s</span>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Formato</span>
          <div className="flex gap-2">
            {(["16:9", "9:16"] as const).map((f) => (
              <button
                key={f}
                className={`btn py-2 flex-1 ${format === f ? "btn-gold" : "btn-outline"}`}
                onClick={() => setFormat(f)}
                disabled={busy}
              >
                {f === "16:9" ? "🖥️ Horizontal 16:9" : "📱 Vertical 9:16"}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={withMessages} onChange={(e) => setWithMessages(e.target.checked)} disabled={busy} />
          <span>
            Intercalar dedicatorias destacadas ({featured.length})
            {!featured.length && <span className="text-muted"> — destácalas con ⭐ en la pestaña Dedicatorias</span>}
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Canción (MP3, opcional)</span>
          <input type="file" accept="audio/*" onChange={(e) => setMusic(e.target.files?.[0] ?? null)} disabled={busy} className="text-xs" />
          <span className="text-muted text-xs">Se repite si es más corta y se desvanece al final.</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-gold" onClick={generate} disabled={busy}>
          🎬 Generar video
        </button>
        {result && (
          <>
            <button className="btn btn-gold" onClick={publish} disabled={busy}>
              🚀 Publicar para todos
            </button>
            <a className="btn btn-outline" href={result.url} download={`video-boda.${result.ext}`}>
              ⬇️ Descargar
            </a>
          </>
        )}
      </div>
      <p className="text-xs text-muted">
        El video se graba en tiempo real en este navegador (usa Chrome en computadora y no cambies de pestaña mientras se graba).
      </p>

      {progress && (
        <div>
          <p className="text-sm text-gold-dark">{progress.label}</p>
          <div className="h-2 bg-cream rounded-full overflow-hidden mt-1">
            <div className="h-full bg-gold transition-all" style={{ width: `${Math.round(progress.f * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <canvas
        ref={canvasRef}
        className={`rounded-xl bg-black mx-auto ${busy && !result ? "" : "hidden"} ${format === "16:9" ? "w-full" : "h-[70vh]"}`}
      />
      {result && (
        <video src={result.url} controls playsInline className={`rounded-xl bg-black mx-auto ${format === "16:9" ? "w-full" : "h-[70vh]"}`} />
      )}

      {state.videoUrl && !result && (
        <div>
          <p className="font-semibold text-sm mb-2">Video publicado actualmente:</p>
          <video src={state.videoUrl} controls playsInline className="rounded-xl bg-black w-full max-h-[60vh]" />
        </div>
      )}
    </div>
  );
}
