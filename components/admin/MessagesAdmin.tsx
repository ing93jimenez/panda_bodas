"use client";

import { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import { api } from "@/lib/api";

type Msg = {
  id: string;
  name: string;
  body: string | null;
  audioUrl: string | null;
  audioDownloadUrl: string | null;
  audioExt: string | null;
  featured: boolean;
  deleted: boolean;
  createdAt: string;
};

export function MessagesAdmin() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    api<{ messages: Msg[] }>("/api/admin/messages")
      .then((r) => setRows(r.messages))
      .catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function patch(json: { id: string; featured?: boolean; deleted?: boolean }) {
    await api("/api/admin/messages", { method: "PATCH", json }).catch((e) => alert(e.message));
    load();
  }

  async function downloadAll() {
    setBusy("Preparando…");
    try {
      const zip = new JSZip();
      const live = rows.filter((m) => !m.deleted);
      const lines = live.map((m, i) => {
        const when = new Date(m.createdAt).toLocaleString("es");
        const audio = m.audioUrl ? `\n[Nota de voz: audio_${String(i + 1).padStart(3, "0")}.${m.audioExt}]` : "";
        return `${m.name} — ${when}\n${m.body ?? ""}${audio}\n`;
      });
      zip.file("dedicatorias.txt", lines.join("\n----------------------------------------\n\n"));
      for (let i = 0; i < live.length; i++) {
        const m = live[i];
        if (!m.audioUrl) continue;
        setBusy(`Descargando audio ${i + 1}…`);
        zip.file(`audio_${String(i + 1).padStart(3, "0")}.${m.audioExt}`, await (await fetch(m.audioUrl)).blob());
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
      a.download = "dedicatorias.zip";
      a.click();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy("");
  }

  const shown = rows.filter((m) => m.deleted === showDeleted);
  const deletedCount = rows.filter((m) => m.deleted).length;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <button className="btn btn-gold py-2" onClick={downloadAll} disabled={!!busy || !rows.some((m) => !m.deleted)}>
          ⬇️ Descargar todas (texto + audios)
        </button>
        {deletedCount > 0 && (
          <button className="btn btn-outline py-2" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? "← Volver" : `🗑️ Eliminadas (${deletedCount})`}
          </button>
        )}
        {busy && <span className="text-sm text-gold-dark shimmer">{busy}</span>}
      </div>
      <p className="text-sm text-muted mb-4">
        Marca con ⭐ las que quieras mostrar en el proyector, en los resultados y en el video. Las demás solo las ven ustedes.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((m) => (
          <li key={m.id} className={`card p-4 ${m.featured ? "ring-2 ring-gold" : ""}`}>
            <div className="flex items-center gap-2 text-sm">
              <b className="flex-1">{m.name}</b>
              <span className="text-xs text-muted">{new Date(m.createdAt).toLocaleString("es", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
            </div>
            {m.body && <p className="mt-2 whitespace-pre-wrap">{m.body}</p>}
            {m.audioUrl && <audio src={m.audioUrl} controls className="w-full h-10 mt-2" />}
            <div className="flex gap-4 mt-3 text-sm">
              {m.deleted ? (
                <button className="underline text-gold-dark" onClick={() => patch({ id: m.id, deleted: false })}>
                  ↩︎ Restaurar
                </button>
              ) : (
                <>
                  <button className="underline text-gold-dark" onClick={() => patch({ id: m.id, featured: !m.featured })} disabled={!m.body}>
                    {m.featured ? "★ Destacada" : "☆ Destacar"}
                  </button>
                  {m.audioDownloadUrl && (
                    <a className="underline text-gold-dark" href={m.audioDownloadUrl}>
                      ⬇️ Audio
                    </a>
                  )}
                  <button
                    className="underline text-red-800 ml-auto"
                    onClick={() => confirm(`¿Eliminar la dedicatoria de ${m.name}?`) && patch({ id: m.id, deleted: true })}
                  >
                    🗑️ Eliminar
                  </button>
                </>
              )}
            </div>
            {!m.body && !m.deleted && <p className="text-[11px] text-muted mt-1">Solo audio: no se puede destacar (el proyector y el video muestran texto).</p>}
          </li>
        ))}
      </ul>
      {!shown.length && <p className="text-muted">{showDeleted ? "No hay eliminadas." : "Aún no hay dedicatorias."}</p>}
    </div>
  );
}
