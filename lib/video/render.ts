"use client";

export type VideoFormat = "16:9" | "9:16";

export interface VideoPhoto {
  url: string;
  photographer: string;
  score: number | null;
  rank: number;
}

export interface RenderOptions {
  photos: VideoPhoto[]; // en el orden en que deben aparecer
  format: VideoFormat;
  title: string; // nombres de los novios
  subtitle?: string; // fecha
  winnerName?: string | null;
  /** Dedicatorias destacadas que se intercalan entre las fotos. */
  messages?: { name: string; body: string }[];
  music?: File | null;
  secondsPerPhoto?: number;
  onProgress?: (fraction: number, label: string) => void;
  canvas?: HTMLCanvasElement; // para vista previa en vivo
}

const FPS = 30;
const FADE = 0.9; // segundos de fundido
const INTRO = 3.5;
const OUTRO = 4.5;
const MAX_BYTES = 45 * 1024 * 1024; // límite de Supabase gratis: 50 MB

const GOLD = "#c9a66b";
const IVORY = "#faf6ee";

export function pickMimeType(): { mime: string; ext: "mp4" | "webm" } {
  const candidates: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  throw new Error("Este navegador no puede grabar video. Usa Chrome en una computadora.");
}

type Segment = { kind: "photo"; i: number } | { kind: "msg"; i: number };

/** Intercala las dedicatorias de forma pareja entre las fotos (nunca al principio). */
export function buildSegments(nPhotos: number, nMessages: number): Segment[] {
  const segs: Segment[] = [];
  const m = Math.min(nMessages, Math.max(0, nPhotos - 1));
  const every = m ? nPhotos / (m + 1) : Infinity;
  let used = 0;
  for (let i = 0; i < nPhotos; i++) {
    segs.push({ kind: "photo", i });
    if (used < m && i + 1 >= Math.round(every * (used + 1))) segs.push({ kind: "msg", i: used++ });
  }
  return segs;
}

export function estimateDuration(n: number, secondsPerPhoto = 4) {
  return INTRO + n * secondsPerPhoto + OUTRO;
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo descargar una foto");
  return createImageBitmap(await res.blob());
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Genera el video en el navegador (Canvas + MediaRecorder). Devuelve el archivo listo para subir. */
export async function renderVideo(opts: RenderOptions): Promise<{ blob: Blob; ext: "mp4" | "webm"; mime: string }> {
  const { photos, format, title, subtitle, winnerName, music, onProgress } = opts;
  const spp = opts.secondsPerPhoto ?? 4;
  const [W, H] = format === "16:9" ? [1920, 1080] : [1080, 1920];
  const canvas = opts.canvas ?? document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 1. Descargar fotos
  const bitmaps: ImageBitmap[] = [];
  for (let i = 0; i < photos.length; i++) {
    onProgress?.(0, `Descargando fotos ${i + 1}/${photos.length}…`);
    bitmaps.push(await loadBitmap(photos[i].url));
  }

  const messages = opts.messages ?? [];
  const segments = buildSegments(photos.length, messages.length);
  const total = estimateDuration(segments.length, spp);
  const serif = getComputedStyle(document.body).getPropertyValue("--font-serif").trim() || "Georgia, serif";
  const s = Math.min(W, H) / 1080; // escala tipográfica

  // 2. Audio
  let audioCtx: AudioContext | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  let startAudio: (() => void) | null = null;
  if (music) {
    onProgress?.(0, "Preparando música…");
    audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(await music.arrayBuffer());
    const dest = audioCtx.createMediaStreamDestination();
    const gain = audioCtx.createGain();
    gain.connect(dest);
    audioTrack = dest.stream.getAudioTracks()[0];
    startAudio = () => {
      const src = audioCtx!.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      const t0 = audioCtx!.currentTime;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(1, t0 + 1.5);
      gain.gain.setValueAtTime(1, t0 + total - 3);
      gain.gain.linearRampToValueAtTime(0, t0 + total - 0.2);
      src.start();
      src.stop(t0 + total);
    };
    await audioCtx.resume();
  }

  // 3. Grabación
  const { mime, ext } = pickMimeType();
  const videoStream = canvas.captureStream(FPS);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...(audioTrack ? [audioTrack] : [])]);
  const bitrate = Math.min(6_000_000, Math.floor((MAX_BYTES * 8) / total) - 160_000);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: Math.max(1_000_000, bitrate),
    audioBitsPerSecond: 128_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

  // --- dibujo ---
  function drawCover(bmp: ImageBitmap, scale: number, dx: number, dy: number, alpha: number, blur = 0) {
    const r = Math.max(W / bmp.width, H / bmp.height) * scale;
    const w = bmp.width * r,
      h = bmp.height * r;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (blur) ctx.filter = `blur(${blur}px) brightness(0.55)`;
    ctx.drawImage(bmp, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
    ctx.restore();
  }
  function drawContain(bmp: ImageBitmap, scale: number, dx: number, dy: number, alpha: number) {
    const pad = format === "16:9" ? 0.92 : 0.86;
    const r = Math.min((W * pad) / bmp.width, (H * pad) / bmp.height) * scale;
    const w = bmp.width * r,
      h = bmp.height * r;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40 * s;
    ctx.drawImage(bmp, (W - w) / 2 + dx, (H - h) / 2 + dy - (format === "9:16" ? 60 * s : 0), w, h);
    ctx.restore();
  }
  function text(
    str: string,
    x: number,
    y: number,
    size: number,
    opts: { color?: string; font?: string; alpha?: number; weight?: number; italic?: boolean } = {},
  ) {
    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    ctx.fillStyle = opts.color ?? IVORY;
    ctx.font = `${opts.italic ? "italic " : ""}${opts.weight ?? 600} ${size}px ${opts.font ?? serif}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function card(alpha: number, lines: () => void) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "#3a3028");
    g.addColorStop(1, "#15110d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2 * s;
    const m = 50 * s;
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    ctx.restore();
    lines();
  }

  function photoAt(i: number, local: number, alpha: number) {
    const bmp = bitmaps[i];
    const p = clamp(local / (spp + FADE));
    const dir = i % 2 ? 1 : -1;
    const z = 1 + 0.08 * ease(p);
    const pan = dir * 30 * s * (p - 0.5);
    drawCover(bmp, 1.15, 0, 0, alpha, 40 * s);
    drawContain(bmp, z, pan, 0, alpha);
    const ph = photos[i];
    const y = H - (format === "9:16" ? 230 : 110) * s;
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    const grd = ctx.createLinearGradient(0, y - 90 * s, 0, H);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, y - 90 * s, W, H - y + 90 * s);
    ctx.restore();
    text(`#${ph.rank}`, W / 2, y - 40 * s, 44 * s, { color: GOLD, alpha });
    text(`📷 ${ph.photographer}`, W / 2, y + 15 * s, 58 * s, { alpha });
    if (ph.score) text("★".repeat(ph.score), W / 2, y + 70 * s, 40 * s, { color: GOLD, alpha, font: "sans-serif" });
  }

  function wrap(str: string, maxWidth: number, size: number): string[] {
    ctx.font = `italic 500 ${size}px ${serif}`;
    const words = str.replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function messageAt(i: number, alpha: number) {
    const m = messages[i];
    card(alpha, () => {
      let size = 64 * s;
      let lines = wrap(`“${m.body}”`, W * 0.78, size);
      while (lines.length > (format === "9:16" ? 12 : 7) && size > 30 * s) {
        size -= 4 * s;
        lines = wrap(`“${m.body}”`, W * 0.78, size);
      }
      const lh = size * 1.3;
      const top = H / 2 - (lines.length * lh) / 2 - 40 * s;
      text("💌 Dedicatoria", W / 2, top - 70 * s, 40 * s, { color: GOLD, alpha, weight: 500 });
      lines.forEach((l, k) => text(l, W / 2, top + k * lh + lh / 2, size, { alpha, weight: 500, font: serif, italic: true }));
      text(`— ${m.name}`, W / 2, top + lines.length * lh + 60 * s, 46 * s, { color: GOLD, alpha });
    });
  }

  function frame(t: number) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const photosStart = INTRO;
    const photosEnd = INTRO + segments.length * spp;

    // Fotos: cada una aparece con fundido sobre la anterior, que sigue debajo hasta cubrirse.
    for (let k = 0; k < segments.length; k++) {
      const start = photosStart + k * spp - FADE;
      const end = start + spp + FADE;
      if (t < start || t > end) continue;
      const local = t - start;
      const seg = segments[k];
      if (seg.kind === "photo") photoAt(seg.i, local, clamp(local / FADE));
      else messageAt(seg.i, clamp(local / FADE));
    }

    // Intro
    if (t < INTRO + FADE) {
      const a = t < INTRO ? clamp(t / 0.8) : clamp(1 - (t - INTRO) / FADE);
      card(a, () => {
        text("Nuestra boda", W / 2, H / 2 - 150 * s, 40 * s, { color: GOLD, alpha: a, weight: 500 });
        text(title, W / 2, H / 2 - 40 * s, 110 * s, { alpha: a });
        text("❦", W / 2, H / 2 + 60 * s, 50 * s, { color: GOLD, alpha: a });
        if (subtitle) text(subtitle, W / 2, H / 2 + 130 * s, 44 * s, { alpha: a * 0.9, weight: 500 });
        text(`Los ${photos.length} mejores momentos`, W / 2, H / 2 + 220 * s, 40 * s, { color: GOLD, alpha: a, weight: 500 });
      });
    }

    // Outro
    if (t > photosEnd - FADE) {
      const a = clamp((t - (photosEnd - FADE)) / FADE) * clamp((total - t) / 0.6);
      card(a, () => {
        if (winnerName) {
          text("Mejor fotógrafo de la noche", W / 2, H / 2 - 140 * s, 44 * s, { color: GOLD, alpha: a, weight: 500 });
          text(`🏆 ${winnerName}`, W / 2, H / 2 - 30 * s, 100 * s, { alpha: a });
        }
        text("¡Gracias por compartir nuestro día!", W / 2, H / 2 + (winnerName ? 110 : 0) * s, 52 * s, { alpha: a, weight: 500 });
        text(title, W / 2, H / 2 + (winnerName ? 200 : 100) * s, 56 * s, { color: GOLD, alpha: a });
      });
    }
  }

  // 4. Reproducir en tiempo real mientras se graba
  frame(0);
  recorder.start(1000);
  startAudio?.();
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      frame(Math.min(t, total));
      onProgress?.(clamp(t / total), "Grabando video… mantén esta pestaña visible");
      if (t >= total) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  await audioCtx?.close();
  bitmaps.forEach((b) => b.close());

  const blob = new Blob(chunks, { type: mime.split(";")[0] });
  if (blob.size > 50 * 1024 * 1024) throw new Error("El video quedó muy pesado; elige menos fotos.");
  return { blob, ext, mime };
}
