"use client";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "content-type": "application/json" } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Error ${res.status}`, res.status);
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function startPolling(fn: () => void, ms: number) {
  // pequeño helper: se usa dentro de useEffect
  fn();
  const t = setInterval(fn, ms);
  const onVis = () => document.visibilityState === "visible" && fn();
  document.addEventListener("visibilitychange", onVis);
  return () => {
    clearInterval(t);
    document.removeEventListener("visibilitychange", onVis);
  };
}
