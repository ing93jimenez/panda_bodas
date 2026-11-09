import { describe, expect, it } from "vitest";
import { acceptsPhoto } from "@/lib/acceptance";

const ended = { status: "ended" as const, ended_at: "2026-11-14T04:00:00Z" };
const now = Date.parse("2026-11-14T06:00:00Z");

describe("acceptsPhoto", () => {
  it("acepta todo mientras el evento está en vivo", () => {
    expect(acceptsPhoto({ status: "live", ended_at: null })).toBe(true);
  });
  it("acepta fotos tomadas antes del cierre que llegan tarde por falta de señal", () => {
    expect(acceptsPhoto(ended, "2026-11-14T03:59:00Z", now)).toBe(true);
  });
  it("rechaza fotos tomadas después del cierre", () => {
    expect(acceptsPhoto(ended, "2026-11-14T04:01:00Z", now)).toBe(false);
  });
  it("rechaza si pasaron más de 24 h del cierre o no hay fecha", () => {
    expect(acceptsPhoto(ended, "2026-11-14T03:00:00Z", Date.parse("2026-11-15T05:00:00Z"))).toBe(false);
    expect(acceptsPhoto(ended, undefined, now)).toBe(false);
  });
});
