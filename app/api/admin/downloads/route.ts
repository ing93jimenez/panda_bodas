import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getGuests, getPhotos, signedUrls } from "@/lib/data";
import { ok } from "@/lib/http";


/** URLs de descarga de TODAS las fotos para armar el ZIP en el navegador. */
export async function GET() {
  await connection();
  const denied = await requireAdmin();
  if (denied) return denied;
  const [photos, guests] = await Promise.all([getPhotos(), getGuests()]);
  const urls = await signedUrls(photos.map((p) => p.storage_path));
  const names = new Map(guests.map((g) => [g.id, g.name]));
  return ok({
    files: photos.map((p, i) => ({
      url: urls.get(p.storage_path),
      name: `${String(i + 1).padStart(4, "0")}_${(names.get(p.guest_id) ?? "invitado").replace(/[^\p{L}\p{N}]+/gu, "_")}_${p.score ?? "x"}estrellas.${p.storage_path.split(".").pop()}`,
    })),
  });
}
