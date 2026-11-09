"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/uploadQueue";

/** Sigue subiendo fotos pendientes en cualquier página de la app. */
export function UploadSync() {
  useEffect(() => startSync(), []);
  return null;
}
