"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, startPolling } from "@/lib/api";
import { prepareImage } from "@/lib/compress";
import { browserDb } from "@/lib/supabase/browser";
import { Header } from "@/components/Header";
import { InAppCamera } from "@/components/InAppCamera";

type Me = {
  guest: { id: string; name: string } | null;
  photoCount: number;
  event: { status: string; coupleNames: string };
};
type Item = { key: string; file: File; state: "queued" | "uploading" | "done" | "error"; error?: string };

async function uploadOne(file: File): Promise<number> {
  const prepared = await prepareImage(file);
  const contentType = prepared.blob.type || "image/jpeg";
  const { path, token } = await api<{ path: string; token: string }>("/api/upload-url", {
    method: "POST",
    json: { contentType },
  });
  const { error } = await browserDb().storage.from("media").uploadToSignedUrl(path, token, prepared.blob, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const r = await api<{ photoCount: number }>("/api/photos", {
    method: "POST",
    json: { path, width: prepared.width || undefined, height: prepared.height || undefined },
  });
  return r.photoCount;
}

export default function Camara() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [flash, setFlash] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [nativeOnly, setNativeOnly] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const running = useRef(false);

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
      }, 20000),
    [router],
  );

  const queue = useRef<Item[]>([]);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      let item: Item | undefined;
      while ((item = queue.current.shift())) {
        const it = item;
        update(it.key, { state: "uploading" });
        for (let attempt = 1; ; attempt++) {
          try {
            const count = await uploadOne(it.file);
            setMe((m) => (m ? { ...m, photoCount: count } : m));
            update(it.key, { state: "done" });
            break;
          } catch (e) {
            const fatal = e instanceof ApiError && e.status < 500;
            if (fatal || attempt >= 3) {
              update(it.key, { state: "error", error: (e as Error).message });
              if (e instanceof ApiError && e.status === 403) router.replace("/resultados");
              break;
            }
            await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
          }
        }
      }
    } finally {
      running.current = false;
    }
  }, [router]);

  function enqueue(list: Item[]) {
    queue.current.push(...list);
    void pump();
  }

  function addFiles(files: FileList | File[] | null, withFlash = true) {
    if (!files?.length) return;
    const add: Item[] = Array.from(files).map((file) => ({
      key: `${Date.now()}-${Math.random()}`,
      file,
      state: "queued",
    }));
    setItems((cur) => [...add, ...cur]);
    if (withFlash) {
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
    }
    enqueue(add);
  }

  const onCameraUnavailable = useCallback(() => {
    setCameraOpen(false);
    setNativeOnly(true);
  }, []);
  const onCapture = useCallback((file: File) => addFiles([file], false), []); // eslint-disable-line react-hooks/exhaustive-deps


  function retry(key: string) {
    const it = items.find((i) => i.key === key);
    if (!it) return;
    update(key, { state: "queued", error: undefined });
    enqueue([{ ...it, state: "queued" }]);
  }

  async function logout() {
    if (!me?.guest) return;
    const pending = queue.current.length > 0 || running.current;
    const msg = [
      `¿No eres ${me.guest.name}? Saldrás para elegir otro nombre.`,
      me.photoCount > 0 &&
        `Las ${me.photoCount} ${me.photoCount === 1 ? "foto que ya tomaste se queda" : "fotos que ya tomaste se quedan"} con el nombre ${me.guest.name}.`,
      pending && "⚠️ Todavía hay fotos subiéndose; si sales ahora podrían perderse.",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!confirm(msg)) return;
    await api("/api/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  const uploading = items.filter((i) => i.state === "queued" || i.state === "uploading").length;
  const failed = items.filter((i) => i.state === "error");

  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 pb-10">
      {flash && <div className="fixed inset-0 bg-white/80 pointer-events-none z-50" />}
      {cameraOpen && (
        <InAppCamera
          onCapture={onCapture}
          onClose={() => setCameraOpen(false)}
          onUnavailable={onCameraUnavailable}
          uploading={items.filter((i) => i.state === "queued" || i.state === "uploading").length}
          photoCount={me?.photoCount ?? 0}
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
          Llevas <span className="text-gold-dark font-bold text-xl">{me?.photoCount ?? 0}</span>{" "}
          {me?.photoCount === 1 ? "foto" : "fotos"}
        </p>

        <div className="flex flex-col gap-3 mt-6">
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

        {uploading > 0 && (
          <p className="mt-4 text-sm text-gold-dark shimmer">
            Subiendo {uploading} {uploading === 1 ? "foto" : "fotos"}… no cierres la app
          </p>
        )}
        {uploading === 0 && items.some((i) => i.state === "done") && failed.length === 0 && (
          <p className="mt-4 text-sm text-green-800">✓ ¡Fotos guardadas! La IA ya las está calificando.</p>
        )}
      </section>

      {failed.length > 0 && (
        <section className="card p-4 mt-4">
          <p className="text-sm font-semibold text-red-800 mb-2">No se pudieron subir {failed.length}:</p>
          <ul className="flex flex-col gap-2">
            {failed.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted">{i.error}</span>
                <button className="btn btn-outline py-1 px-3 text-xs" onClick={() => retry(i.key)}>
                  Reintentar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-center text-muted mt-6 px-4">
        Tus fotos se guardan de forma privada y no se pueden borrar. Se revelarán las mejores al final de la fiesta.
      </p>

      <Link href="/ranking" className="btn btn-outline mt-6 self-center">
        🏆 Ver ranking de fotógrafos
      </Link>
    </main>
  );
}
