"use client";

import { useEffect, useState } from "react";
import { api, startPolling } from "@/lib/api";

export type FeaturedMessage = { id: string; name: string; body: string };

export function useFeaturedMessages(intervalMs = 30000) {
  const [messages, setMessages] = useState<FeaturedMessage[]>([]);
  useEffect(
    () =>
      startPolling(() => {
        api<{ messages: FeaturedMessage[] }>("/api/messages/featured")
          .then((r) => setMessages(r.messages))
          .catch(() => {});
      }, intervalMs),
    [intervalMs],
  );
  return messages;
}

/** Una dedicatoria destacada a la vez, rotando (para el proyector). */
export function MessageTicker({ messages, every = 9000, big = false }: { messages: FeaturedMessage[]; every?: number; big?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), every);
    return () => clearInterval(t);
  }, [messages.length, every]);
  const m = messages[i % Math.max(1, messages.length)];
  if (!m) return null;
  return (
    <figure key={m.id} className="fade-up text-center">
      <blockquote className={`title italic ${big ? "text-3xl leading-snug" : "text-xl"}`}>“{m.body}”</blockquote>
      <figcaption className={`text-muted mt-2 ${big ? "text-xl" : "text-sm"}`}>— {m.name}</figcaption>
    </figure>
  );
}
