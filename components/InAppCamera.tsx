"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Facing = "environment" | "user";

/**
 * Cámara dentro de la app: cada disparo se guarda al instante, sin el
 * "Usar foto / Repetir" que muestra la cámara nativa de iOS.
 */
export function InAppCamera({
  onCapture,
  onClose,
  onUnavailable,
  uploading,
  photoCount,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void;
  uploading: number;
  photoCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState(0);
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(
    async (mode: Facing) => {
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: mode }, width: { ideal: 4096 }, height: { ideal: 4096 } },
        });
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch {
        stop();
        onUnavailable();
      }
    },
    [onUnavailable],
  );

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      void Promise.resolve().then(onUnavailable);
      return;
    }
    // start() solo actualiza estado después de esperar a getUserMedia (asíncrono).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start(facing);
    // iOS corta la cámara al salir de la app; la reanudamos al volver.
    const onVis = () => {
      if (document.visibilityState === "visible" && !streamRef.current?.active) void start(facing);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [facing, start, onUnavailable]);

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    setShots((n) => n + 1);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none" role="dialog" aria-label="Cámara">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        onLoadedData={() => setReady(true)}
        className={`flex-1 min-h-0 w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
      />
      {flash && <div className="absolute inset-0 bg-white pointer-events-none" />}

      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white text-sm">
        <button onClick={onClose} className="rounded-full bg-black/50 px-4 py-2 font-semibold" aria-label="Cerrar cámara">
          ✕ Listo
        </button>
        <span className="rounded-full bg-black/50 px-3 py-1.5">
          {uploading > 0 ? `Subiendo ${uploading}…` : `${photoCount} ${photoCount === 1 ? "foto" : "fotos"} ✓`}
        </span>
      </div>

      <div className="absolute bottom-0 inset-x-0 flex items-center justify-around pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/60 to-transparent">
        <span className="w-14 text-center text-white text-xs">{shots > 0 && `+${shots}`}</span>
        <button
          onClick={shoot}
          disabled={!ready}
          aria-label="Tomar foto"
          className="w-20 h-20 rounded-full border-4 border-white bg-white/30 active:bg-white/70 active:scale-95 transition disabled:opacity-40"
        />
        <button
          onClick={() => {
            setReady(false);
            setFacing((f) => (f === "environment" ? "user" : "environment"));
          }}
          disabled={!canSwitch}
          aria-label="Cambiar cámara"
          className="w-14 h-14 rounded-full bg-black/50 text-white text-2xl disabled:invisible"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
