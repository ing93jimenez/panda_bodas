"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = { id: string; title: string; bonus: number; active: boolean; attempts: number; completedBy: number };

const IDEAS = [
  "Foto con los abuelos",
  "El primer beso de los novios",
  "Alguien bailando en la pista",
  "Selfie con los novios",
  "El brindis",
  "Los anillos",
  "Un niño o niña de la familia",
  "La mesa más divertida",
];

export function ChallengesAdmin({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [bonus, setBonus] = useState(0.1);

  const load = useCallback(() => {
    api<{ challenges: Row[] }>("/api/admin/challenges")
      .then((r) => setRows(r.challenges))
      .catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function call(method: "POST" | "PATCH" | "DELETE", json: unknown) {
    try {
      await api("/api/admin/challenges", { method, json });
    } catch (e) {
      alert((e as Error).message);
    }
    load();
    onChange();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-2">Agregar retos</h2>
        <p className="text-sm text-muted mb-2">
          Uno por línea. Los invitados eligen un reto antes de tomar la foto; la IA verifica que se cumpla y, si es así,
          suman el bono a su puntaje (una vez por reto).
        </p>
        <textarea className="input h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder={IDEAS.slice(0, 4).join("\n")} />
        <label className="text-sm flex items-center gap-2 mt-3">
          Bono por reto cumplido
          <input
            type="number"
            className="input w-24 py-1"
            min={0}
            max={1}
            step={0.05}
            value={bonus}
            onChange={(e) => setBonus(+e.target.value)}
          />
          <span className="text-xs text-muted">estrellas sobre el promedio</span>
        </label>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            className="btn btn-gold py-2"
            disabled={!text.trim()}
            onClick={async () => {
              const titles = text.split("\n").map((t) => t.trim()).filter(Boolean);
              await call("POST", { titles, bonus });
              setText("");
            }}
          >
            Agregar
          </button>
          {!rows.length && (
            <button className="btn btn-outline py-2" onClick={() => setText(IDEAS.join("\n"))}>
              Usar ideas de ejemplo
            </button>
          )}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="title text-2xl font-semibold mb-3">Retos ({rows.length})</h2>
        <ul className="flex flex-col divide-y divide-gold-light">
          {rows.map((r) => (
            <li key={r.id} className={`py-2 text-sm flex flex-wrap items-center gap-2 ${r.active ? "" : "opacity-50"}`}>
              <span className="flex-1 min-w-[140px]">{r.title}</span>
              <span className="text-xs text-muted">
                {r.completedBy} cumplido(s) · {r.attempts} intento(s)
              </span>
              <input
                type="number"
                className="input w-20 py-1 text-xs"
                min={0}
                max={1}
                step={0.05}
                defaultValue={r.bonus}
                title="Bono"
                onBlur={(e) => +e.target.value !== r.bonus && call("PATCH", { id: r.id, bonus: +e.target.value })}
              />
              <button className="text-xs underline text-gold-dark" onClick={() => call("PATCH", { id: r.id, active: !r.active })}>
                {r.active ? "ocultar" : "mostrar"}
              </button>
              <button
                className="text-xs underline text-red-800"
                onClick={() =>
                  confirm(`¿Eliminar el reto “${r.title}”? Las fotos se conservan, pero dejan de sumar ese bono.`) &&
                  call("DELETE", { id: r.id })
                }
              >
                eliminar
              </button>
            </li>
          ))}
          {!rows.length && <li className="text-muted text-sm py-2">Aún no hay retos. Si no agregas ninguno, no aparecen en la app.</li>}
        </ul>
      </section>
    </div>
  );
}
