"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { useOrigin } from "@/lib/useOrigin";
import { api, ApiError, startPolling } from "@/lib/api";
import { Leaderboard } from "@/components/Leaderboard";
import { QR } from "@/components/QR";
import { VideoMaker } from "@/components/admin/VideoMaker";
import { ChallengesAdmin } from "@/components/admin/ChallengesAdmin";
import { MessagesAdmin } from "@/components/admin/MessagesAdmin";
import { PeopleAdmin } from "@/components/admin/PeopleAdmin";
import type { AdminState } from "@/components/admin/types";

type Tab = "resumen" | "invitados" | "personas" | "fotos" | "retos" | "dedicatorias" | "video";

export default function Admin() {
  const [state, setState] = useState<AdminState | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("resumen");

  const load = useCallback(() => {
    api<AdminState>("/api/admin/state")
      .then((s) => {
        setState(s);
        setAuthed(true);
      })
      .catch((e) => e instanceof ApiError && e.status === 401 && setAuthed(false));
  }, []);

  useEffect(() => startPolling(load, 15000), [load]);

  if (authed === false) return <Login onOk={load} />;
  if (!state) return <p className="text-center text-muted shimmer mt-20">Cargando panel…</p>;

  const ended = state.event.status === "ended";

  return (
    <main className="max-w-5xl w-full mx-auto px-4 pb-16">
      <header className="flex flex-wrap items-center gap-3 py-6">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Panel de los novios</p>
          <h1 className="title text-3xl font-semibold">{state.event.couple_names}</h1>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${ended ? "bg-ink text-ivory" : "bg-green-100 text-green-900"}`}>
          {ended ? "Evento terminado" : "● En vivo"}
        </span>
        <Link href="/proyector" target="_blank" className="btn btn-outline py-2">
          🖥️ Proyector
        </Link>
        <button
          className="btn btn-outline py-2"
          onClick={async () => {
            await api("/api/admin/logout", { method: "POST" });
            setAuthed(false);
          }}
        >
          Salir
        </button>
      </header>

      <EndControls state={state} onChange={load} />

      <nav className="flex flex-wrap gap-2 my-6">
        {(
          [
            ["resumen", "Resumen"],
            ["invitados", `Invitados (${state.guests.length})`],
            ["fotos", `Fotos (${state.stats.total})`],
            ["personas", "👥 Personas clave"],
            ["retos", "🎯 Retos"],
            ["dedicatorias", "💌 Dedicatorias"],
            ["video", "Video"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} className={`btn py-2 whitespace-nowrap ${tab === k ? "btn-gold" : "btn-outline"}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "resumen" && <Summary state={state} onChange={load} />}
      {tab === "invitados" && <Guests state={state} onChange={load} />}
      {tab === "fotos" && <Photos state={state} onChange={load} />}
      {tab === "personas" && <PeopleAdmin state={state} onChange={load} />}
      {tab === "retos" && <ChallengesAdmin onChange={load} />}
      {tab === "dedicatorias" && <MessagesAdmin />}
      {tab === "video" && <VideoMaker state={state} onDone={load} />}
    </main>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <form
        className="card p-8 w-full max-w-sm text-center"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/api/admin/login", { method: "POST", json: { pin } });
            onOk();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="title text-3xl font-semibold mb-1">Panel de los novios</h1>
        <p className="text-sm text-muted mb-5">Ingresa el PIN de administrador</p>
        <input className="input text-center text-xl tracking-widest" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        <button className="btn btn-gold w-full mt-4" disabled={busy || !pin}>
          Entrar
        </button>
        {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
      </form>
    </main>
  );
}

function EndControls({ state, onChange }: { state: AdminState; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const ended = state.event.status === "ended";
  async function run(url: string, msg: string) {
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await api(url, { method: "POST" });
      onChange();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card p-5 flex flex-wrap items-center gap-4">
      {!ended ? (
        <>
          <p className="flex-1 text-sm min-w-[220px]">
            Cuando termine la fiesta, pulsa aquí: se dejan de recibir fotos y todos verán al ganador, las mejores fotos y el video.
            {state.stats.pending > 0 && (
              <span className="block text-gold-dark mt-1">⚠️ Hay {state.stats.pending} fotos aún calificándose; espera un momento o recalifícalas en “Fotos”.</span>
            )}
          </p>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => run("/api/admin/end", "¿Terminar el evento y revelar los resultados a todos?")}
          >
            🏁 Terminar evento
          </button>
        </>
      ) : (
        <>
          <p className="flex-1 text-sm min-w-[220px]">
            Resultados revelados. Genera y publica el video en la pestaña “Video”. Si terminaste por error, puedes reabrir.
          </p>
          <Link href="/resultados" target="_blank" className="btn btn-outline">
            Ver resultados
          </Link>
          <button className="btn btn-outline" disabled={busy} onClick={() => run("/api/admin/reopen", "¿Reabrir el evento? Los invitados podrán volver a subir fotos.")}>
            Reabrir
          </button>
        </>
      )}
    </section>
  );
}

function Summary({ state, onChange }: { state: AdminState; onChange: () => void }) {
  const [names, setNames] = useState(state.event.couple_names);
  const [date, setDate] = useState(state.event.event_date ?? "");
  const [min, setMin] = useState(state.event.min_photos_for_winner);
  const [saved, setSaved] = useState(false);
  const origin = useOrigin();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-3">Datos del evento</h2>
        <form
          className="flex flex-col gap-3 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            await api("/api/admin/event", { method: "PATCH", json: { coupleNames: names, eventDate: date || null, minPhotos: min } });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            onChange();
          }}
        >
          <label>
            Nombres de los novios
            <input className="input mt-1" value={names} onChange={(e) => setNames(e.target.value)} />
          </label>
          <label>
            Fecha de la boda
            <input className="input mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Mínimo de fotos calificadas para ganar
            <input className="input mt-1" type="number" min={1} max={100} value={min} onChange={(e) => setMin(+e.target.value)} />
          </label>
          <button className="btn btn-gold">{saved ? "✓ Guardado" : "Guardar"}</button>
        </form>
      </section>

      <section className="card p-5 text-center">
        <h2 className="title text-2xl font-semibold mb-3">QR para los invitados</h2>
        {origin && <QR url={origin} size={220} className="mx-auto" />}
        <p className="text-sm mt-2 break-all text-muted">{origin}</p>
        <p className="text-xs text-muted mt-2">Imprímelo y ponlo en las mesas. Clic derecho → “Guardar imagen”.</p>
      </section>

      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-3">Estado</h2>
        <ul className="text-sm flex flex-col gap-1">
          <li>📸 {state.stats.total} fotos</li>
          <li>⏳ {state.stats.pending} calificándose · ❌ {state.stats.failed} con error</li>
          <li>🤖 Claude: {state.stats.byProvider.claude} · Gemini: {state.stats.byProvider.gemini}</li>
          <li>👥 {state.guests.filter((g) => g.claimed).length} de {state.guests.length} invitados conectados</li>
        </ul>
      </section>

      <section>
        <h2 className="title text-2xl font-semibold mb-3">Ranking</h2>
        <Leaderboard board={state.board} minPhotos={state.event.min_photos_for_winner} highlightId={state.event.winner_guest_id} />
      </section>
    </div>
  );
}

function Guests({ state, onChange }: { state: AdminState; onChange: () => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  async function act(id: string, action: "release" | "delete", confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    try {
      await api("/api/admin/guests", { method: "PATCH", json: { id, action } });
      onChange();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-2">Agregar invitados</h2>
        <p className="text-sm text-muted mb-2">Un nombre por línea. Usa nombre y apellido si hay nombres repetidos.</p>
        <textarea className="input h-56" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Ana López\nCarlos Pérez\n…"} />
        <button
          className="btn btn-gold w-full mt-3"
          disabled={!text.trim()}
          onClick={async () => {
            const names = text.split("\n").map((n) => n.trim()).filter(Boolean);
            const r = await api<{ added: number; skipped: number }>("/api/admin/guests", { method: "POST", json: { names } });
            setMsg(`Agregados: ${r.added}${r.skipped ? ` · repetidos omitidos: ${r.skipped}` : ""}`);
            setText("");
            onChange();
          }}
        >
          Agregar
        </button>
        {msg && <p className="text-sm text-green-800 mt-2">{msg}</p>}
      </section>
      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-3">Lista</h2>
        <ul className="flex flex-col divide-y divide-gold-light">
          {state.guests.map((g) => (
            <li key={g.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="flex-1">{g.name}</span>
              <span className="text-muted text-xs">{g.photos} fotos</span>
              <span className={`text-xs ${g.claimed ? "text-green-800" : "text-muted"}`}>{g.claimed ? "conectado" : "libre"}</span>
              {g.claimed && (
                <button className="text-xs underline text-gold-dark" onClick={() => act(g.id, "release", `¿Liberar a ${g.name}? Podrá elegir su nombre desde otro celular (sus fotos se conservan).`)}>
                  liberar
                </button>
              )}
              {g.canDelete && (
                <button className="text-xs underline text-red-800" onClick={() => act(g.id, "delete", `¿Eliminar a ${g.name} de la lista?`)}>
                  eliminar
                </button>
              )}
            </li>
          ))}
          {!state.guests.length && <li className="text-muted text-sm py-2">Aún no hay invitados.</li>}
        </ul>
      </section>
    </div>
  );
}

function Photos({ state, onChange }: { state: AdminState; onChange: () => void }) {
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<string>("all");

  async function rescore() {
    setBusy("Calificando…");
    try {
      for (let i = 0; i < 50; i++) {
        const r = await api<{ processed: number; remaining: number }>("/api/admin/score", { method: "POST" });
        setBusy(`Calificando… quedan ${r.remaining}`);
        if (!r.processed || !r.remaining) break;
      }
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy("");
    onChange();
  }

  async function downloadAll() {
    setBusy("Preparando ZIP…");
    try {
      const { files } = await api<{ files: { url: string; name: string }[] }>("/api/admin/downloads");
      const zip = new JSZip();
      for (let i = 0; i < files.length; i++) {
        setBusy(`Descargando ${i + 1}/${files.length}…`);
        const res = await fetch(files[i].url);
        zip.file(files[i].name, await res.blob());
      }
      setBusy("Comprimiendo…");
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fotos-boda.zip";
      a.click();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy("");
  }

  async function setChallengeOk(id: string, challengeOk: boolean) {
    await api("/api/admin/photo", { method: "PATCH", json: { id, challengeOk } });
    onChange();
  }

  async function setScore(id: string, score: number) {
    await api("/api/admin/photo", { method: "PATCH", json: { id, score } });
    onChange();
  }

  async function move(photoIds: string[], toGuestId: string, label: string) {
    const to = state.guests.find((g) => g.id === toGuestId);
    if (!to || !confirm(`¿Mover ${label} a ${to.name}?`)) return;
    try {
      const r = await api<{ moved: number }>("/api/admin/move", { method: "POST", json: { photoIds, toGuestId } });
      setBusy(`✓ ${r.moved} ${r.moved === 1 ? "foto movida" : "fotos movidas"} a ${to.name}`);
      setTimeout(() => setBusy(""), 2500);
      if (filter !== "all" && filter !== "problems") setFilter(to.name);
    } catch (e) {
      alert((e as Error).message);
    }
    onChange();
  }

  async function trash(photoIds: string[], restore: boolean, label: string) {
    const msg = restore
      ? `¿Restaurar ${label}?`
      : `¿Eliminar ${label}?\n\nDejará de contar en el ranking, el Top, el video y las descargas. Podrás restaurarla desde “Eliminadas”.`;
    if (!confirm(msg)) return;
    try {
      const r = await api<{ count: number }>("/api/admin/trash", { method: "POST", json: { photoIds, restore } });
      setBusy(`✓ ${r.count} ${r.count === 1 ? "foto" : "fotos"} ${restore ? "restaurada(s)" : "eliminada(s)"}`);
      setTimeout(() => setBusy(""), 2500);
    } catch (e) {
      alert((e as Error).message);
    }
    onChange();
  }

  const filteredGuest = state.guests.find((g) => g.name === filter);

  const visible = state.photos.filter((p) => !p.deleted);
  const guests = Array.from(new Set(visible.map((p) => p.photographer))).sort();
  const shown =
    filter === "deleted"
      ? state.photos.filter((p) => p.deleted)
      : visible.filter((p) => filter === "all" || (filter === "problems" ? p.status !== "scored" : p.photographer === filter));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <button className="btn btn-gold py-2" onClick={rescore} disabled={!!busy}>
          🤖 Recalificar pendientes ({state.stats.pending + state.stats.failed})
        </button>
        <button className="btn btn-outline py-2" onClick={downloadAll} disabled={!!busy || !visible.length}>
          ⬇️ Descargar todas (ZIP)
        </button>
        <select className="input w-auto py-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todas (ordenadas por calificación)</option>
          <option value="problems">Pendientes / con error</option>
          {state.stats.deleted > 0 && <option value="deleted">🗑️ Eliminadas ({state.stats.deleted})</option>}
          {guests.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {busy && <span className="text-sm text-gold-dark shimmer">{busy}</span>}
      </div>
      {filteredGuest && shown.length > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span>
            Mover las {shown.length} fotos de <b>{filteredGuest.name}</b> a:
          </span>
          <select
            className="input w-auto py-1"
            value=""
            onChange={(e) =>
              e.target.value && move(shown.map((p) => p.id), e.target.value, `las ${shown.length} fotos de ${filteredGuest.name}`)
            }
          >
            <option value="">Elegir invitado…</option>
            {state.guests
              .filter((g) => g.id !== filteredGuest.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {shown.map((p) => (
          <div key={p.id} className={`card overflow-hidden ${p.deleted ? "opacity-60" : ""}`}>
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="w-full aspect-square object-cover" />
              </a>
            )}
            <div className="p-2 text-xs flex flex-col gap-1">
              <p className="font-semibold truncate">
                {p.rank ? `#${p.rank} · ` : ""}
                {p.photographer}
              </p>
              <div className="flex gap-0.5" title="Corregir calificación">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`text-lg leading-none ${(p.score ?? 0) >= n ? "text-gold" : "text-gold-light"}`} onClick={() => setScore(p.id, n)}>
                    ★
                  </button>
                ))}
              </div>
              <p className="text-muted">
                {p.status === "scored"
                  ? `${p.manual ? "manual" : p.provider} · ${p.fineScore ?? "—"}/100`
                  : p.status === "failed"
                    ? "❌ error"
                    : "⏳ calificando"}
              </p>
              {p.reason && <p className="text-ink/80 text-[13px] leading-snug">{p.reason}</p>}
              {p.people.length > 0 && <p className="text-ink/80">👥 {p.people.join(", ")}</p>}
              {p.challenge && (
                <div className="rounded-md bg-cream px-2 py-1">
                  <p>
                    🎯 {p.challenge.title}:{" "}
                    <b>{p.challenge.ok === true ? "✅ cumplido" : p.challenge.ok === false ? "❌ no cumplido" : "⏳ revisando"}</b>
                    {p.challenge.manual && <span className="text-muted"> (manual)</span>}
                  </p>
                  <div className="flex gap-3 mt-0.5">
                    <button className="underline text-gold-dark" onClick={() => setChallengeOk(p.id, true)}>
                      marcar cumplido
                    </button>
                    <button className="underline text-red-800" onClick={() => setChallengeOk(p.id, false)}>
                      no cumplido
                    </button>
                  </div>
                </div>
              )}
              {p.error && (
                <details className="text-red-700">
                  <summary className="cursor-pointer">Ver detalle del error</summary>
                  <p className="mt-1 break-words">{p.error}</p>
                </details>
              )}
              {p.deleted ? (
                <button className="mt-1 text-xs underline text-gold-dark self-start" onClick={() => trash([p.id], true, "esta foto")}>
                  ↩︎ Restaurar
                </button>
              ) : (
              <>
              <select
                className="mt-1 border border-gold-light rounded-md px-1 py-0.5 bg-white text-xs"
                value=""
                title="Mover esta foto a otro invitado"
                onChange={(e) => e.target.value && move([p.id], e.target.value, `esta foto de ${p.photographer}`)}
              >
                <option value="">↪ Mover a…</option>
                {state.guests
                  .filter((g) => g.id !== p.guestId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
              <button
                className="mt-1 text-xs underline text-red-800 self-start"
                onClick={() => trash([p.id], false, `esta foto de ${p.photographer}`)}
              >
                🗑️ Eliminar
              </button>
              </>
              )}
            </div>
          </div>
        ))}
      </div>
      {!shown.length && <p className="text-muted">No hay fotos.</p>}
    </div>
  );
}
