export type EventStatus = "live" | "ended";

export interface EventRow {
  id: number;
  couple_names: string;
  event_date: string | null;
  status: EventStatus;
  min_photos_for_winner: number;
  ended_at: string | null;
  winner_guest_id: string | null;
  top_photo_ids: string[];
  top_count: number;
  video_path: string | null;
  ai_context: string;
}

export interface GuestRow {
  id: string;
  name: string;
  device_token: string | null;
  claimed_at: string | null;
}

export interface PhotoRow {
  id: string;
  guest_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  status: "pending" | "scoring" | "scored" | "failed";
  score: number | null;
  fine_score: number | null;
  ai_reason: string | null;
  ai_provider: string | null;
  manual_override: boolean;
  error: string | null;
  deleted_at: string | null;
  client_key: string | null;
  captured_at: string | null;
  challenge_id: string | null;
  challenge_ok: boolean | null;
  challenge_manual: boolean;
  people: string[];
  created_at: string;
}

export interface PersonRow {
  id: string;
  name: string;
  role: string;
  photo_path: string;
  sort: number;
}

export interface ChallengeRow {
  id: string;
  title: string;
  bonus: number;
  sort: number;
  active: boolean;
}

export interface MessageRow {
  id: string;
  guest_id: string;
  body: string | null;
  audio_path: string | null;
  featured: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  guestId: string;
  name: string;
  photos: number;
  scored: number;
  /** Promedio de estrellas de sus fotos calificadas. */
  average: number | null;
  /** Retos distintos cumplidos (verificados). */
  challenges: number;
  /** Puntos extra por retos. */
  bonus: number;
  /** Puntaje final = promedio + bonus. Es lo que decide el ranking. */
  total: number | null;
  eligible: boolean;
}
