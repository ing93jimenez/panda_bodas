import { describe, expect, it } from "vitest";
import { buildLeaderboard, pickWinner, rankPhotos } from "@/lib/ranking";

const guests = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Beto" },
  { id: "c", name: "Caro" },
  { id: "d", name: "Dani" },
];
let n = 0;
const photo = (guest_id: string, score: number | null, fine_score: number | null = null) => ({
  id: `p${++n}`,
  guest_id,
  score,
  fine_score,
  created_at: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
});

describe("buildLeaderboard", () => {
  it("una sola foto perfecta no gana si no llega al mínimo", () => {
    const photos = [photo("a", 5), photo("b", 4), photo("b", 4), photo("b", 4)];
    const board = buildLeaderboard(guests, photos, 3);
    expect(board[0].name).toBe("Beto");
    expect(board[0].eligible).toBe(true);
    expect(board[1]).toMatchObject({ name: "Ana", eligible: false });
    expect(pickWinner(board)?.name).toBe("Beto");
  });

  it("empate en promedio lo gana quien tiene más fotos calificadas", () => {
    const photos = [photo("a", 4), photo("a", 4), photo("a", 4), photo("c", 4), photo("c", 4), photo("c", 4), photo("c", 4)];
    const board = buildLeaderboard(guests, photos, 3);
    expect(board.map((e) => e.name)).toEqual(["Caro", "Ana"]);
  });

  it("fotos sin calificar cuentan como tomadas pero no en el promedio", () => {
    const board = buildLeaderboard(guests, [photo("d", null), photo("d", 3)], 1);
    expect(board[0]).toMatchObject({ photos: 2, scored: 1, average: 3, eligible: true });
  });

  it("no hay ganador si nadie es elegible", () => {
    expect(pickWinner(buildLeaderboard(guests, [photo("a", 5)], 3))).toBeNull();
  });

  it("excluye invitados sin fotos", () => {
    expect(buildLeaderboard(guests, [], 1)).toEqual([]);
  });
});

describe("rankPhotos", () => {
  it("ordena por estrellas, luego puntaje fino, luego la más antigua", () => {
    const p1 = photo("a", 5, 90);
    const p2 = photo("b", 5, 97);
    const p3 = photo("c", 4, 99);
    const p4 = photo("d", 5, 90);
    const p5 = photo("d", null);
    expect(rankPhotos([p3, p4, p1, p5, p2]).map((p) => p.id)).toEqual([p2.id, p1.id, p4.id, p3.id]);
  });
});

describe("bonus por retos", () => {
  const gs = [
    { id: "a", name: "Ana" },
    { id: "b", name: "Beto" },
  ];
  let k = 100;
  const ph = (guest_id: string, score: number, challenge_id?: string, challenge_ok?: boolean | null) => ({
    id: `q${++k}`,
    guest_id,
    score,
    fine_score: null,
    created_at: `2026-01-01T00:01:${String(k % 60).padStart(2, "0")}Z`,
    challenge_id: challenge_id ?? null,
    challenge_ok: challenge_ok ?? null,
  });
  const bonus = new Map([
    ["r1", 0.1],
    ["r2", 0.25],
  ]);

  it("suma el bono una sola vez por reto distinto cumplido", () => {
    const board = buildLeaderboard(
      gs,
      [ph("a", 4, "r1", true), ph("a", 4, "r1", true), ph("a", 4, "r2", true), ph("b", 4, "r1", false)],
      1,
      bonus,
    );
    const ana = board.find((e) => e.name === "Ana")!;
    expect(ana).toMatchObject({ average: 4, challenges: 2, bonus: 0.35, total: 4.35 });
    expect(board.find((e) => e.name === "Beto")).toMatchObject({ challenges: 0, bonus: 0, total: 4 });
  });

  it("los retos pueden voltear el ranking", () => {
    const board = buildLeaderboard(gs, [ph("a", 4, "r2", true), ph("b", 4.2 as number)], 1, bonus);
    expect(board.map((e) => e.name)).toEqual(["Ana", "Beto"]);
  });

  it("retos eliminados o pendientes no suman", () => {
    const board = buildLeaderboard(gs, [ph("a", 3, "borrado", true), ph("a", 3, "r1", null)], 1, bonus);
    expect(board[0]).toMatchObject({ bonus: 0, total: 3 });
  });
});
