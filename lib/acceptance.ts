import type { EventRow } from "./types";

/** Horas después del cierre en que aún se aceptan fotos tomadas ANTES del cierre (sin señal). */
export const LATE_UPLOAD_HOURS = 24;

/**
 * ¿Se acepta una foto? Siempre mientras el evento está en vivo. Ya cerrado,
 * solo si se tomó antes del cierre (se quedó esperando señal) y no ha pasado
 * demasiado tiempo.
 */
export function acceptsPhoto(event: Pick<EventRow, "status" | "ended_at">, capturedAt?: string | null, now = Date.now()) {
  if (event.status === "live") return true;
  if (!event.ended_at || !capturedAt) return false;
  const ended = Date.parse(event.ended_at);
  const captured = Date.parse(capturedAt);
  if (Number.isNaN(captured)) return false;
  return captured <= ended && now - ended <= LATE_UPLOAD_HOURS * 3600_000;
}
