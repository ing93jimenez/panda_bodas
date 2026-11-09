"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
export function useOrigin() {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}
