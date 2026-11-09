"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, startPolling } from "@/lib/api";
import { addPhotos, getServerState, getState, retryStuck, subscribe } from "@/lib/uploadQueue";
import { Header } from "@/components/Header";
import { InAppCamera } from "@/components/InAppCamera";
import { Challenges, type Challenge } from "@/components/Challenges";

type Me = {
  guest: { id: string; name: string } | null;
  photoCount: number;
  event: { status: string; coupleNames: string };
};

export default function Camara() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [flash, setFlash] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nativeOnly, setNativeOnly] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [savedSome, setSavedSome] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const queue = useSyncExternalStore(subscribe, getState, getServerState);

  const loadChallenges = useCallback(() => {
    api<{ challenges: Challenge[] }>("/api/challenges")
      .then((r) => setChallenges(r.challenges))
      .catch(() => {});
  }, []);

  useEffect(
    () =>
      startPolling(() => {
        api<Me>("/api/me")
          .then((m) => {
            if (m.event.status === "ended") router.replace("/resultados");
            else if (!m.guest) router.replace("/");
            else setMe(m);
          })
          .catch(() => {});
        loadChallenges();
      }, 20000),
    [router, loadChallenges],
  );

  // El contador sube en cuanto el servidor confirma cada foto.
  const photoCount = Math.max(me?.photoCount ?? 0, queue.photoCount ?? 0);

  function addFiles(files: FileList | File[] | null, withFlash = true) {
    if (!files?.length) return;
    addPhotos(Array.from(files), activeChallenge?.id ?? null);
    setSavedSome(true);
    if (withFlash) {
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
    }
  }

  const onCameraUnavailable = useCallback(() => {
    setCameraOpen(false);
    setNativeOnly(true);
  }, []);
  const challengeId = activeChallenge?.id ?? null;
  const onCapture = useCallback(
    (file: File) => {
      addPhotos([file], challengeId);
      setSavedSome(true);
    },
    [challengeId],
  );

  async function logout() {
    if (!me?.guest) return;
    const pending = queue.pending > 0;
    const msg = [
      `¿No eres ${me.guest.name}? Saldrás para elegir otro nombre.`,
      photoCount > 0 &&
        `Las ${photoCount} ${photoCount === 1 ? "foto que ya tomaste se queda" : "fotos que ya tomaste se quedan"} con el nombre ${me.guest.name}.`,
      pending && `⚠️ Hay ${queue.pending} fotos esperando señal; se subirán con el nombre que elijas después.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!confirm(msg)) return;
    await api("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  const waiting = queue.pending;

  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 pb-10">
      {flash && <div className="fixed inset-0 bg-white/80 pointer-events-none z-50" />}
      {cameraOpen && (
        <InAppCamera
          onCapture={onCapture}
          onClose={() => {
            setCameraOpen(false);
            loadChallenges();
          }}
          onUnavailable={onCameraUnavailable}
          pending={waiting}
          online={queue.online && !queue.waitingSignal}
          photoCount={photoCount}
          challenge={activeChallenge?.title ?? null}
          onClearChallenge={() => setActiveChallenge(null)}
        />
      )}
      <Header coupleNames={me?.event.coupleNames} />

      <section className="card p-6 text-center fade-up">
        <p className="text-muted text-sm">Hola,</p>
        <p className="title text-3xl font-semibold">{me?.guest?.name ?? "…"}</p>
        {me?.guest && (
          <button className="text-xs text-muted underline mt-1" onClick={logout}>
            ¿No eres tú? Salir
          </button>
        )}
        <p className="mt-3 text-muted">
          Llevas <span className="text-gold-dark font-bold text-xl">{photoCount}</span>{" "}
          {photoCount === 1 ? "foto" : "fotos"}
        </p>

        {activeChallenge && (
          <div className="mt-4 rounded-xl bg-cream px-3 py-2 text-sm flex items-center gap-2 justify-between">
            <span className="text-left">
              🎯 Reto activo: <b>{activeChallenge.title}</b>
            </span>
            <button className="text-xs underline text-muted shrink-0" onClick={() => setActiveChallenge(null)}>
              Quitar
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-5">
          <button
            className="btn btn-gold text-lg py-5"
            onClick={() => (nativeOnly ? cameraRef.current?.click() : setCameraOpen(true))}
          >
            📸 Tomar foto
          </button>
          <button className="btn btn-outline" onClick={() => galleryRef.current?.click()}>
            🖼️ Subir de mi galería
          </button>
        </div>
        {nativeOnly ? (
          <p className="text-xs text-muted mt-3">
            No pudimos abrir la cámara dentro de la app (¿se negó el permiso?). Usaremos la cámara del celular.
          </p>
        ) : (
          <button className="text-xs text-muted underline mt-3" onClick={() => cameraRef.current?.click()}>
            Usar la cámara del celular
          </button>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {waiting > 0 && (
          <p className={`mt-4 text-sm ${queue.online && !queue.waitingSignal ? "text-gold-dark shimmer" : "text-muted"}`}>
            {queue.online && !queue.waitingSignal
              ? `Subiendo ${waiting} ${waiting === 1 ? "foto" : "fotos"}…`
              : `📶 ${queue.online ? "Señal débil" : "Sin señal"}: ${waiting} ${waiting === 1 ? "foto guardada" : "fotos guardadas"} en tu celular. Se subirán solas cuando mejore la señal; no hace falta que hagas nada.`}
          </p>
        )}
        {waiting === 0 && savedSome && queue.stuck === 0 && !queue.busy && (
          <p className="mt-4 text-sm text-green-800">✓ ¡Fotos guardadas! La IA ya las está calificando.</p>
        )}
      </section>

      {queue.stuck > 0 && (
        <section className="card p-4 mt-4 text-sm">
          <p className="font-semibold text-red-800">
            {queue.stuck} {queue.stuck === 1 ? "foto no se pudo subir" : "fotos no se pudieron subir"}
          </p>
          <p className="text-muted mt-1">{queue.stuckReason}</p>
          <button className="btn btn-outline py-1 px-3 text-xs mt-2" onClick={() => void retryStuck()}>
            Reintentar
          </button>
        </section>
      )}

      <Challenges
        challenges={challenges}
        active={activeChallenge}
        onPick={(c) => setActiveChallenge(c?.id === activeChallenge?.id ? null : c)}
      />

      <p className="text-xs text-center text-muted mt-6 px-4">
        Tus fotos se guardan primero en tu celular y se suben aunque haya mala señal. No se pueden borrar. Se revelarán
        las mejores al final de la fiesta.
      </p>

      <div className="flex flex-col gap-3 mt-6 items-center">
        <Link href="/dedicatoria" className="btn btn-outline">
          💌 Dejar una dedicatoria a los novios
        </Link>
        <Link href="/ranking" className="btn btn-outline">
          🏆 Ver ranking de fotógrafos
        </Link>
      </div>
    </main>
  );
}
