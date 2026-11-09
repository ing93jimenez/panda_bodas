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
  created_at: string;
}

export interface LeaderboardEntry {
  guestId: string;
  name: string;
  photos: number;
  scored: number;
  average: number | null;
  eligible: boolean;
}
