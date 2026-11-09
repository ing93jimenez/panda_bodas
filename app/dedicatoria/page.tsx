"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { browserDb } from "@/lib/supabase/browser";
import { Header } from "@/components/Header";

const MAX_SECONDS = 60;
const MAX_CHARS = 600;

type Mine = { id: string; body: string | null; audioUrl: string | null; createdAt: string };

function pickAudioType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"])
    if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
}

export default function Dedicatoria() {
  const router = useRouter();
  const [coupleNames, setCoupleNames] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [audio, setAudio] = useState<{ blob: Blob; url: string; type: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<Mine[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioType = useRef<string | null>(null);

  const loadMine = useCallback(() => {
    api<{ messages: Mine[] }>("/api/messages")
      .then((r) => setMine(r.messages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    audioType.current = pickAudioType();
    api<{ guest: { name: string } | null; event: { coupleNames: string } }>("/api/me")
      .then((m) => {
        if (!m.guest) return router.replace("/");
        setName(m.guest.name);
        setCoupleNames(m.event.coupleNames);
        loadMine();
      })
      .catch(() => {});
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [router, loadMine]);

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function startRecording() {
    setError("");
    const type = audioType.current;
    if (!type) return setError("Tu navegador no permite grabar audio. Puedes escribir tu dedicatoria.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: type });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const clean = type.split(";")[0];
        const blob = new Blob(chunks, { type: clean });
        setAudio({ blob, url: URL.createObjectURL(blob), type: clean });
      };
      recorderRef.current = rec;
      rec.start(500);
      setRecording(true);
      setSeconds(0);
      const t0 = Date.now();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch {
      setError("No pudimos usar el micrófono (¿se negó el permiso?). Puedes escribir tu dedicatoria.");
    }
  }

  async function send() {
    if (!body.trim() && !audio) return;
    setBusy(true);
    setError("");
    try {
      let audioPath: string | undefined;
      if (audio) {
        const { path, token } = await api<{ path: string; token: string }>("/api/messages/upload-url", {
          method: "POST",
          json: { contentType: audio.type },
        });
        const { error } = await browserDb()
          .storage.from("media")
          .uploadToSignedUrl(path, token, audio.blob, { contentType: audio.type, upsert: false });
        if (error) throw new Error(error.message);
        audioPath = path;
      }
      await api("/api/messages", { method: "POST", json: { body: body.trim() || undefined, audioPath } });
      setBody("");
      setAudio(null);
      setSent(true);
      loadMine();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No se pudo enviar. Revisa tu señal e inténtalo de nuevo; tu mensaje sigue aquí.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 pb-10">
      <Header coupleNames={coupleNames} subtitle="Déjales unas palabras a los novios 💌" />

      {sent ? (
        <section className="card p-6 text-center fade-up">
          <p className="text-5xl">💌</p>
          <p className="title text-3xl font-semibold mt-2">¡Gracias, {name}!</p>
          <p className="text-muted text-sm mt-2">Tu dedicatoria les llegó a los novios.</p>
          <div className="flex flex-col gap-3 mt-5">
            <button className="btn btn-outline" onClick={() => setSent(false)}>
              Escribir otra
            </button>
            <Link href="/camara" className="btn btn-gold">
              📸 Volver a tomar fotos
            </Link>
          </div>
        </section>
      ) : (
        <section className="card p-5 fade-up">
          <label className="text-sm font-semibold" htmlFor="msg">
            Tu mensaje
          </label>
          <textarea
            id="msg"
            className="input mt-1 h-36"
            maxLength={MAX_CHARS}
            placeholder="Les deseo…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-[11px] text-muted text-right">
            {body.length}/{MAX_CHARS}
          </p>

          <div className="mt-3">
            <p className="text-sm font-semibold mb-2">Nota de voz (opcional)</p>
            {recording ? (
              <button className="btn btn-danger w-full" onClick={stopRecording}>
                ⏹️ Detener · {seconds}s / {MAX_SECONDS}s
              </button>
            ) : audio ? (
              <div className="flex items-center gap-2">
                <audio src={audio.url} controls className="flex-1 min-w-0 h-10" />
                <button className="text-xs underline text-red-800" onClick={() => setAudio(null)}>
                  Quitar
                </button>
              </div>
            ) : (
              <button className="btn btn-outline w-full" onClick={startRecording}>
                🎙️ Grabar (máx. {MAX_SECONDS} s)
              </button>
            )}
          </div>

          <button className="btn btn-gold w-full mt-5" onClick={send} disabled={busy || recording || (!body.trim() && !audio)}>
            {busy ? "Enviando…" : "💌 Enviar dedicatoria"}
          </button>
          {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        </section>
      )}

      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="title text-2xl font-semibold mb-2">Tus dedicatorias</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((m) => (
              <li key={m.id} className="card p-3 text-sm">
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.audioUrl && <audio src={m.audioUrl} controls className="w-full h-10 mt-2" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/camara" className="text-sm text-muted underline mt-6 self-center">
        ← Volver a la cámara
      </Link>
    </main>
  );
}
