# Fotos de la boda 📸

App web para que los invitados tomen/suban fotos desde el celular (sin poder borrarlas), la IA las califique de 1 a 5 ★ y, al terminar el evento, se revele el mejor fotógrafo, las mejores fotos y un video.

## Rutas
- `/` – el invitado elige su nombre de la lista (QR general)
- `/camara` – tomar foto o subir de la galería
- `/ranking` – ranking de fotógrafos en vivo (sin fotos)
- `/resultados` – revelación final (ganador, top, video, descargas)
- `/proyector` – vista para pantalla del salón (clic para avanzar)
- `/admin` – panel de los novios (PIN)

## Variables de entorno
| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase |
| `SUPABASE_SECRET_KEY` | Clave secreta (service role) de Supabase — solo servidor |
| `ADMIN_PIN` | PIN del panel `/admin` |
| `ANTHROPIC_API_KEY` | Clave de Claude (calificador principal) |
| `GEMINI_API_KEY` | Clave de Gemini (respaldo si Claude falla o se acaba el saldo) |
| `CLAUDE_MODEL` / `GEMINI_MODEL` | Opcional: modelo a usar |

## Desarrollo
```bash
npm install
npm run dev
npm test
```
Esquema de base de datos: `supabase/migrations/0001_init.sql`.
