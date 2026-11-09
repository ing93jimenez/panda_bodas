"use client";

export type Challenge = {
  id: string;
  title: string;
  bonus: number;
  status: "done" | "checking" | "missed" | null;
};

const BADGE: Record<NonNullable<Challenge["status"]>, string> = {
  done: "✅",
  checking: "⏳",
  missed: "↻",
};

/** Lista de retos: el invitado elige uno y sus próximas fotos cuentan para ese reto. */
export function Challenges({
  challenges,
  active,
  onPick,
}: {
  challenges: Challenge[];
  active: Challenge | null;
  onPick: (c: Challenge | null) => void;
}) {
  if (!challenges.length) return null;
  const done = challenges.filter((c) => c.status === "done").length;
  return (
    <section className="card p-5 mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="title text-2xl font-semibold">🎯 Retos</h2>
        <span className="text-xs text-muted">
          {done}/{challenges.length} cumplidos
        </span>
      </div>
      <p className="text-xs text-muted mt-1 mb-3">
        Elige un reto y toma la foto. Si la IA confirma que lo cumpliste, sumas puntos extra en el ranking.
      </p>
      <ul className="flex flex-col gap-2">
        {challenges.map((c) => {
          const isActive = active?.id === c.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => onPick(c)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm flex items-center gap-2 ${
                  isActive ? "border-gold bg-cream ring-2 ring-gold" : "border-gold-light bg-white"
                }`}
              >
                <span className="w-5 text-center">{c.status ? BADGE[c.status] : "○"}</span>
                <span className="flex-1">{c.title}</span>
                <span className="text-xs text-gold-dark whitespace-nowrap">+{c.bonus.toFixed(2)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted mt-3">
        ✅ cumplido · ⏳ la IA lo está revisando · ↻ no se notó en la foto, inténtalo de nuevo
      </p>
    </section>
  );
}
