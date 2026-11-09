import { describe, expect, it } from "vitest";
import { buildSegments } from "@/lib/video/render";

const kinds = (s: { kind: string }[]) => s.map((x) => (x.kind === "photo" ? "F" : "D")).join("");

describe("buildSegments", () => {
  it("sin dedicatorias solo hay fotos", () => {
    expect(kinds(buildSegments(4, 0))).toBe("FFFF");
  });
  it("intercala las dedicatorias de forma pareja y nunca al inicio ni al final", () => {
    expect(kinds(buildSegments(10, 2))).toBe("FFFDFFFFDFFF");
    const s = kinds(buildSegments(10, 4));
    expect(s.startsWith("F") && s.endsWith("F")).toBe(true);
    expect(s.split("D").length - 1).toBe(4);
  });
  it("no usa más dedicatorias que huecos entre fotos", () => {
    expect(kinds(buildSegments(2, 5))).toBe("FDF");
    expect(kinds(buildSegments(1, 3))).toBe("F");
  });
});
