"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Header } from "@/components/Header";

type Guest = { id: string; name: string; claimed: boolean };
type Me = { guest: { id: string; name: string } | null; event: { status: string; coupleNames: string } };

export default function Home() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Guest | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await api<Me>("/api/me");
      if (m.event.status === "ended") return router.replace("/resultados");
      if (m.guest) return router.replace("/camara");
      setMe(m);
      const g = await api<{ guests: Guest[] }>("/api/guests");
      setGuests(g.guests);
    })().catch((e) => setError(e.message));
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return guests.filter((g) => g.name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").includes(q));
  }, [guests, query]);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/claim", { method: "POST", json: { guestId: selected.id } });
      router.replace("/camara");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-4 pb-10">
      <Header coupleNames={me?.event.coupleNames} subtitle="Captura la boda y gana el premio al mejor fotógrafo 📸" />

      {!me && !error && <p className="text-center text-muted shimmer mt-10">Cargando…</p>}

      {me && !selected && (
        <section className="card p-5 fade-up">
          <h2 className="title text-2xl font-semibold text-center">¿Quién eres?</h2>
          <p className="text-sm text-muted text-center mb-4">Busca tu nombre en la lista de invitados</p>
          <input
            className="input mb-3"
            placeholder="Escribe tu nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {filtered.map((g) => (
              <li key={g.id}>
                <button
                  className="w-full text-left px-4 py-3 rounded-xl border border-gold-light bg-white disabled:opacity-40 hover:bg-cream"
                  disabled={g.claimed}
                  onClick={() => setSelected(g)}
                >
                  {g.name} {g.claimed && <span className="text-xs text-muted">(ya registrado)</span>}
                </button>
              </li>
            ))}
            {!filtered.length && (
              <li className="text-center text-sm text-muted py-4">
                {guests.length ? "No encontramos ese nombre." : "La lista de invitados aún está vacía."}
              </li>
            )}
          </ul>
        </section>
      )}

      {selected && (
        <section className="card p-6 text-center fade-up">
          <p className="text-muted">Vas a participar como</p>
          <p className="title text-3xl font-semibold my-2">{selected.name}</p>
          <p className="text-sm text-muted mb-5">
            Este nombre quedará asociado a este celular y a todas tus fotos.
          </p>
          <div className="flex flex-col gap-3">
            <button className="btn btn-gold" onClick={confirm} disabled={busy}>
              {busy ? "Un momento…" : "Sí, soy yo"}
            </button>
            <button className="btn btn-outline" onClick={() => setSelected(null)} disabled={busy}>
              Elegir otro
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-center text-red-700 mt-4 text-sm">{error}</p>}
    </main>
  );
}
