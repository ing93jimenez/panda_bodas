"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QR({ url, size = 240, className = "" }: { url: string; size?: number; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url, { width: size * 2, margin: 1, color: { dark: "#2d2620", light: "#fffdf8" } }).then(setSrc);
  }, [url, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} width={size} height={size} alt={`QR para ${url}`} className={className} /> : null;
}
