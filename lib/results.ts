import type { LeaderboardEntry } from "./types";

export type Results = {
  event: { status: string; coupleNames: string; eventDate: string | null; minPhotos: number };
  winner: LeaderboardEntry | null;
  board: LeaderboardEntry[];
  top: {
    rank: number;
    id: string;
    score: number | null;
    photographer: string;
    url?: string;
    downloadUrl?: string;
    width: number | null;
    height: number | null;
  }[];
  video: { url: string; downloadUrl: string } | null;
};
