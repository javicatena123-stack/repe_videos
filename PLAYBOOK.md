# repe. — Manual de producción automática

Canal de gimnasio **repe.** (Instagram @munstergym + YouTube Shorts; TikTok más adelante). Javier valida: cada pieza se le envía y queda programada en Metricool, donde puede editarla o cancelarla antes de la hora.

## 1. Marca y tono
- Fondo #111013, coral #FE594D, blanco. Titulares en Anton (mayúsculas), subtítulos en Poppins 800 con palabras clave en coral. Píldora "repe." arriba, barra de progreso coral.
- Tono didáctico con humor, frases cortas, un cambio de escena cada 2-3 s. Público: desde quien empieza hasta quien ya entrena (España).
- Voz en off: **siempre Achird** (Gemini `gemini-3.8-flash-tts`). Solo para borradores o si se agota el cupo: Achird con `gemini-3.8-flash-lite-tts`.
- Todo dato debe estar comprobado con una fuente fiable (estudio, organismo, revisión). Nada de consejos médicos ni cifras inventadas. Citar la fuente en el copy cuando sea un estudio.

## 2. Parrilla diaria
| Hora | Pieza | Enfoque |
|---|---|---|
| 14:00 | Vídeo (Reel + Short) | Nutrición / mitos / ciencia práctica (hora de comer) |
| 18:00 | Carrusel (solo Instagram) | Humor identificable o guía para guardar (antes de la hora punta) |
| 20:30 | Vídeo (Reel + Short) | Entreno, técnica, recuperación, mitos o humor de gym |

## 3. Investigación de tendencias (cada mañana)
1. Revisa qué se publicó (`historial.json`) y las métricas de lo de ayer (Metricool analytics) para repetir lo que funciona.
2. vidIQ: **máximo 1 búsqueda al día** (`vidiq_instagram_tiktok_outlier_search`, 5 créditos) y solo si quedan más de 15 créditos (`vidiq_balance`; el plan gratis renueva el día 2 de cada mes). Rota el tema: técnica, nutrición, humor/cultura gym, recuperación, mitos.
3. WebSearch: noticias y debates fitness/nutrición/wellness de la semana en España y estudios recientes.
4. Elige 3 temas que no estén en `historial.json` de los últimos 30 días. Formatos que más funcionan ahora en el nicho hispano: "error vs correcto", "mito desmontado con un estudio", listas rápidas con valoración, humor identificable ("la hora a la que entrenas te define", "excusas", "tipos de gente en el gym").

## 4. Guion de vídeo (JSON en `content/AAAA-MM-DD/`)
- 12-15 escenas, 35-45 s. Escena 1 = gancho (pregunta o afirmación que choca). Última = CTA (guardar / etiquetar / comentar).
- Cada escena: `say` (lo que lee la voz, números escritos con letra si se leen raro), `sub` (subtítulo, *palabras* en coral), `kind` + parámetros.
- Tipos disponibles (`engine/scenes.html`):
  - `num`: icon, label, value, unit — tarjeta con número que cuenta.
  - `vs`: a{icon,value,unit,label,white}, b{...} — dos tarjetas enfrentadas.
  - `head`: lines[], coral[idx], size, icon, iconSize, mark("check"|"cross"), strike(idx), badge.
  - `stamp`: text ("MITO"), icon — sello que golpea.
  - `bars`: items[{label,value,top,coral}], caption.
  - `clock`: hours, full, text, label — anillo que se llena.
  - `timeline`: max, ticks[], marks[{from,to,label,up,coral,at}].
  - `eyes`: title — ojos de reojo (humor).
  - `neq`: left, right — "A ≠ B".
  - `chips`: items[{icon,label}], top, fs — filas con icono.
  - `stairs` — figura en escaleras (humor). `cta`: l1, l2, size1, l2lines.
  - Iconos: shaker, drumstick, toilet, paper, plate, muscle, crystals, stairs, drop, flame, battery, fibers(broken|repair), dumbbell, glass, clock, sun, moon, coffee, tupper, crowd, calendar, check, cross. Si hace falta uno nuevo, añádelo a `ICONS` en `scenes.html` (SVG 200×200, trazo blanco 9 px, acentos coral).
- Carrusel (`carrusel_*.json`): slides `cover` (l1,l2,icon,sub), `item` (time,title,icon,text,titleSize), `cta` (l1,l2,text). 6-8 diapositivas, 1080×1350.

## 5. Producción (rutas)
- PC (device_bash): `$HOME/mnt/Videos/Munster Gym/` → `repe/engine`, `repe/content`, `work/`, claves en `.repe/` (**nunca** imprimirlas, copiarlas al repo ni a mensajes).
- Nube: Playwright + ffmpeg ya instalados. Desde la nube no se llega a Google ni a GitHub mientras la sesión está vinculada al PC: **la voz y la subida se hacen en el PC**; el render en la nube.
- Pasos por vídeo:
  1. Escribe el JSON en la nube y pásalo al PC con `device_commit_files` usando **siempre una carpeta nueva** en `/mnt/user-data/outputs/sync_<hora>/` (reutilizar una ruta puede dejar la versión vieja en el PC). Comprueba con `grep` en el PC que llegó.
  2. PC: `cd "$HOME/mnt/Videos/Munster Gym/repe" && python3 engine/tts_pc.py content/FECHA/X.json ../work/FECHA/X_voz_raw.wav gemini-3.8-flash-tts Achird` (exit 3 = cupo agotado → repetir con `gemini-3.8-flash-lite-tts`). Cupo gratis: 10 peticiones/día por modelo, se renueva a las 9:00. Una petición = un vídeo entero; no gastes peticiones en pruebas.
  3. Opcional (QA): `python3 engine/transcribe_pc.py ../work/FECHA/X_voz_raw.wav gemini-3.5-transcribe`.
  4. Pasa el motor a la nube: en el PC `tar czf ../work/engine.tgz -C . engine`, luego `device_stage_files` de `engine.tgz`, del JSON y de la voz; en la nube descomprime en `/home/claude/repe/`.
  5. Nube: `python3 engine/build.py ingest X.json work/X` (copia antes la voz como `work/X/voz_raw.wav`; si la voz leyó las instrucciones, se recorta sola y avisa) → `align` → revisa que no haya `flags` y que cada escena tenga sentido → `render` → `mix ... salida.mp4` → `stills` y **mira `sheet.jpg`** antes de dar el vídeo por bueno.
  6. Carrusel: `node engine/carousel.mjs carrusel.json work/carrusel` y mira las diapositivas.
  7. Pasa los finales al PC (`device_commit_files`, carpeta `Videos/Munster Gym/FECHA/`) y súbelos: `python3 engine/push_pc.py "mensaje" "../FECHA/x.mp4" videos/FECHA-tema.mp4 ...` → devuelve las URLs raw (deben dar 200).
  8. Envía a Javier los vídeos y el carrusel (SendUserFile) con el copy.

## 6. Publicación (Metricool, blogId 7824439, Europe/Madrid)
- Reel: providers instagram, `instagramData {type: REEL, showReelOnFeed: true, isAiGenerated: true}`, `videoCoverMilliseconds` en el gancho.
- Short: providers youtube, `youtubeData {title, type: short, privacy: public, tags, category: SPORTS, madeForKids: false, isAiGeneratedContent: true}`; texto con `#shorts`.
- Carrusel: providers instagram, `instagramData {type: POST, isAiGenerated: false}`, media = lista de URLs de las diapositivas.
- Para cambiar el vídeo de un post ya programado: `updateScheduledPost` con la nueva URL (Metricool guarda su propia copia; cambiar el archivo en GitHub no basta).
- **Límite del plan gratuito de Metricool: 20 publicaciones/mes** (cada red cuenta aparte). Antes de programar, cuenta con `getScheduledPosts` (del día 1 a fin de mes) las publicadas + pendientes. Si no caben, no programes: deja los archivos listos, envíaselos a Javier y avísale.
- Copy: gancho en la primera línea, 3-4 líneas con emojis y el dato clave, CTA, 6-9 hashtags en español.

## 7. Registro
Añade cada pieza a `historial.json` (fecha, hora, tipo, tema, título, ids de Metricool, modelo de voz) y súbelo con `push_pc.py`.
