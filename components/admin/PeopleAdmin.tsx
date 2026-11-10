"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { api } from "@/lib/api";
import { browserDb } from "@/lib/supabase/browser";
import type { AdminState } from "./types";

type Person = { id: string; name: string; role: string; url: string | null };

const ROLES = [
  "Novia",
  "Novio",
  "Mamá de la novia",
  "Papá de la novia",
  "Mamá del novio",
  "Papá del novio",
  "Hermana de la novia",
  "Hermano del novio",
  "Abuela",
  "Abuelo",
  "Padrino",
  "Madrina",
];

/** Reduce la referencia a 768 px: suficiente para reconocer la cara y barata de enviar a la IA. */
async function uploadReference(file: File): Promise<string> {
  const blob = await imageCompression(file, { maxWidthOrHeight: 768, maxSizeMB: 0.4, fileType: "image/jpeg", initialQuality: 0.85 });
  const { path, token } = await api<{ path: string; token: string }>("/api/admin/people/upload-url", {
    method: "POST",
    json: { contentType: "image/jpeg" },
  });
  const { error } = await browserDb().storage.from("media").uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export function PeopleAdmin({ state, onChange }: { state: AdminState; onChange: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [context, setContext] = useState(state.event.ai_context ?? "");
  const [savedCtx, setSavedCtx] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<{ people: Person[] }>("/api/admin/people")
      .then((r) => setPeople(r.people))
      .catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function add() {
    if (!file || !name.trim() || !role.trim()) return;
    setBusy("Subiendo foto…");
    try {
      const photoPath = await uploadReference(file);
      await api("/api/admin/people", { method: "POST", json: { name: name.trim(), role: role.trim(), photoPath } });
      setName("");
      setRole("");
      setFile(null);
      setPreview(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy("");
  }

  async function replacePhoto(p: Person, f: File) {
    setBusy(`Cambiando la foto de ${p.name}…`);
    try {
      const photoPath = await uploadReference(f);
      await api("/api/admin/people", { method: "PATCH", json: { id: p.id, photoPath } });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy("");
  }

  async function remove(p: Person) {
    if (!confirm(`¿Quitar a ${p.name} (${p.role}) de las personas clave?`)) return;
    await api("/api/admin/people", { method: "DELETE", json: { id: p.id } }).catch((e) => alert(e.message));
    load();
  }

  async function rescoreAll() {
    const n = state.stats.total;
    if (
      !confirm(
        `¿Volver a calificar las ${n} fotos con las personas clave y el contexto actuales?\n\n` +
          "Cada foto conserva su calificación actual hasta que la IA termine. Esto vuelve a usar la IA (costo aprox. igual al de calificarlas por primera vez). Las estrellas que corregiste a mano se respetan.",
      )
    )
      return;
    setBusy("Recalificando…");
    try {
      let first = true;
      for (let i = 0; i < 400; i++) {
        const r = await api<{ processed: number; remaining: number }>("/api/admin/score", {
          method: "POST",
          json: first ? { all: true } : {},
        });
        first = false;
        setBusy(`Recalificando… quedan ${r.remaining}`);
        if (!r.processed || !r.remaining) break;
      }
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy("");
    onChange();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-1">Contexto de la boda para la IA</h2>
        <p className="text-sm text-muted mb-2">
          Ayuda a la IA a entender su boda: tipo de ceremonia, vestimenta, lugar, tradiciones… Así no busca, por ejemplo, un vestido
          de novia que no habrá.
        </p>
        <textarea
          className="input h-28"
          maxLength={1000}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Ej.: Boda civil y casual en un jardín. Los novios no usan vestido de novia ni traje formal; Laura usa un vestido blanco sencillo y Sebas camisa azul. Hay mariachi y baile."
        />
        <button
          className="btn btn-gold py-2 mt-2"
          onClick={async () => {
            await api("/api/admin/event", { method: "PATCH", json: { aiContext: context } });
            setSavedCtx(true);
            setTimeout(() => setSavedCtx(false), 2000);
            onChange();
          }}
        >
          {savedCtx ? "✓ Guardado" : "Guardar contexto"}
        </button>
      </section>

      <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
        <section className="card p-5">
          <h2 className="title text-2xl font-semibold mb-1">Agregar persona clave</h2>
          <p className="text-sm text-muted mb-3">
            Una foto clara de la cara (de frente, buena luz, sin lentes oscuros). No importa la ropa: puede ser de cualquier día.
          </p>
          <button
            className="w-full aspect-square max-w-[220px] mx-auto rounded-xl border-2 border-dashed border-gold-light flex items-center justify-center overflow-hidden bg-white"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-muted text-sm px-4 text-center">📷 Elegir foto</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : null);
              e.target.value = "";
            }}
          />
          <label className="text-sm block mt-3">
            Nombre
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Laura" maxLength={80} />
          </label>
          <label className="text-sm block mt-3">
            Papel en la boda
            <input
              className="input mt-1"
              list="roles"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Novia, Papá del novio…"
              maxLength={80}
            />
            <datalist id="roles">
              {ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <button className="btn btn-gold w-full mt-4" onClick={add} disabled={!!busy || !file || !name.trim() || !role.trim()}>
            Agregar
          </button>
        </section>

        <section className="card p-5">
          <h2 className="title text-2xl font-semibold mb-3">Personas clave ({people.length})</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {people.map((p) => (
              <li key={p.id} className="text-center">
                <label className="block cursor-pointer" title="Cambiar foto">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={p.name} className="w-full aspect-square object-cover rounded-xl border border-gold-light" />
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-cream" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void replacePhoto(p, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="font-semibold text-sm mt-1">{p.name}</p>
                <p className="text-xs text-muted">{p.role}</p>
                <button className="text-xs underline text-red-800" onClick={() => remove(p)}>
                  quitar
                </button>
              </li>
            ))}
          </ul>
          {!people.length && (
            <p className="text-sm text-muted">
              Aún no hay personas clave. Empieza por los novios y sus papás; así la IA reconoce “foto con los papás del novio”.
            </p>
          )}
          {people.length > 0 && <p className="text-[11px] text-muted mt-3">Toca una foto para cambiarla.</p>}
        </section>
      </div>

      <section className="card p-5 flex flex-wrap items-center gap-4">
        <p className="flex-1 text-sm min-w-[220px]">
          Las fotos nuevas ya usan esta información. Si ya había fotos antes de cargar las personas clave o el contexto, puedes
          volver a calificarlas para que la IA reconozca quién aparece y revise de nuevo los retos.
        </p>
        <button className="btn btn-outline" onClick={rescoreAll} disabled={!!busy || !state.stats.total}>
          🔁 Recalificar todas ({state.stats.total})
        </button>
      </section>
      {busy && <p className="text-sm text-gold-dark shimmer">{busy}</p>}
    </div>
  );
}
