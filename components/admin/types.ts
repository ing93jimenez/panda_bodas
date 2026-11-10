import type { EventRow, LeaderboardEntry } from "@/lib/types";

export type AdminPhoto = {
  id: string;
  photographer: string;
  guestId: string;
  url: string | null;
  status: string;
  score: number | null;
  fineScore: number | null;
  reason: string | null;
  provider: string | null;
  manual: boolean;
  error: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  rank: number | null;
  deleted: boolean;
  people: string[];
  challenge: { title: string; ok: boolean | null; manual: boolean } | null;
};

export type AdminState = {
  event: EventRow;
  videoUrl: string | null;
  board: LeaderboardEntry[];
  guests: { id: string; name: string; claimed: boolean; photos: number; canDelete: boolean }[];
  photos: AdminPhoto[];
  stats: { total: number; deleted: number; pending: number; failed: number; byProvider: { claude: number; gemini: number } };
};
