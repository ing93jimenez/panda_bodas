"use client";
import imageCompression from "browser-image-compression";

export interface Prepared {
  blob: Blob;
  width: number;
  height: number;
}

/** Reduce la foto a ~2048 px y JPEG para subir rápido con mala señal. */
export async function prepareImage(file: File): Promise<Prepared> {
  let blob: Blob = file;
  try {
    blob = await imageCompression(file, {
      maxWidthOrHeight: 2048,
      maxSizeMB: 1.5,
      fileType: "image/jpeg",
      initialQuality: 0.85,
      useWebWorker: true,
    });
  } catch {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Formato de imagen no soportado");
    }
  }
  let width = 0,
    height = 0;
  try {
    const bmp = await createImageBitmap(blob);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {}
  return { blob, width, height };
}
