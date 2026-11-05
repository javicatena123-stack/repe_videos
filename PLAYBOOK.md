# repe. — Manual de producción automática

Canal de gimnasio **repe.** (Instagram @byrepe, TikTok @by_repe, YouTube Shorts y Threads @byrepe; marca «byrepe» en Metricool). Javier valida: cada pieza se le envía y queda programada en Metricool, donde puede editarla o cancelarla antes de la hora.

## 1. Marca y tono
- Fondo #111013, coral #FE594D, blanco. Titulares en Anton (mayúsculas), subtítulos en Poppins 800 con palabras clave en coral. Píldora "repe." arriba, barra de progreso coral.
- Tono didáctico con humor, frases cortas, un cambio de escena cada 2-3 s. Público: desde quien empieza hasta quien ya entrena (España).
- Voz en off: **siempre Achird** (Gemini `gemini-3.8-flash-tts`). Solo para borradores o si se agota el cupo: Achird con `gemini-3.8-flash-lite-tts`.
- Todo dato debe estar comprobado con una fuente fiable (estudio, organismo, revisión). Nada de consejos médicos ni cifras inventadas. Citar la fuente en el copy cuando sea un estudio.

## 2. Parrilla diaria
| Hora | Pieza | Enfoque |
|---|---|---|
| 14:00 | Vídeo (Reel + TikTok + Short + Threads) | Nutrición / mitos / ciencia práctica (hora de comer) |
| 20:30 | Vídeo (Reel + TikTok + Short + Threads) | Entreno, técnica, recuperación, mitos o humor de gym |

Desde el 5 nov 2026 **no se hacen carruseles** (no funcionaban): solo los dos vídeos diarios. Las publicaciones fuera de esta parrilla (p. ej. el extra de las 7:30 del 6 nov) son excepcionales y solo si Javier las pide.

## 3. Investigación de tendencias (cada mañana)
1. Revisa qué se publicó (`historial.json`) y las métricas de lo de ayer (Metricool analytics) para repetir lo que funciona.
2. vidIQ: **máximo 1 búsqueda al día** (`vidiq_instagram_tiktok_outlier_search`, 5 créditos) y solo si quedan más de 15 créditos (`vidiq_balance`; el plan gratis renueva el día 2 de cada mes). Rota el tema: técnica, nutrición, humor/cultura gym, recuperación, mitos.
3. WebSearch: noticias y debates fitness/nutrición/wellness de la semana en España y estudios recientes.
4. Elige 3 temas que no estén en `historial.json` de los últimos 30 días. Formatos que más funcionan ahora en el nicho hispano: "error vs correcto", "mito desmontado con un estudio", listas rápidas con valoración, humor identificable ("la hora a la que entrenas te define", "excusas", "tipos de gente en el gym").

## 4. Guion de vídeo (JSON en `content/AAAA-MM-DD/`)
- 12-15 escenas, 35-45 s. Última = CTA (guardar / etiquetar / comentar).
- **Gancho (escena 1), lo más importante:** tipo clickbait, jugoso, que choque en el primer segundo. A Javier le encantó el de la creatina («¿La creatina te hincha, te deja calvo y te destroza el riñón?», con tres miedos en filas) y el de las excusas («Tu excusa para no ir al gym tiene nota. Y spoiler: es un cero», con sello 0/10). Fórmulas: acusar o retar al que mira («tu excusa es un cero», «lo estás haciendo mal»), juntar varios miedos o mitos en una pregunta, un número que escandaliza, o una promesa de giro. Siempre verdadero: el vídeo tiene que cumplir lo que promete el gancho. Visual del gancho con impacto (sello, chips con iconos, número grande), nunca un título quieto. Sube el tono hasta que el que mira piense «¿pero qué…?»: imágenes absurdas pero ciertas («¿Piernas de caballo y tren superior de pollito?», con la tarjeta del pollito), notas humillantes, retos directos. Di siempre el término exacto (tren superior, no «arriba»).
- **Variedad visual:** no repitas el mismo tipo de gráfico dos veces en un vídeo (p. ej. dos `bars`); alterna `vs`, `num`, `timeline`, `clock`, `chips`… Y cada cosa con su icono propio: si se nombran músculos distintos, usa `chest` (pecho), `back` (espalda), `shoulder` (hombro), `muscle` (bíceps), `legs` (piernas); nunca el mismo icono repetido en una lista. El mismo `kind` dos veces seguidas, solo si es `head`.
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
  - Iconos: chest, back, shoulder, legs, chick (pollito), tub (creatina), kidney, head (pelo), shirt, thermo, sofa, shaker, drumstick, toilet, paper, plate, muscle, crystals, stairs, drop, flame, battery, fibers(broken|repair), dumbbell, glass, clock, sun, moon, coffee, tupper, crowd, calendar, check, cross. Si hace falta uno nuevo, añádelo en `scenes.html`: dibujo estático en `STATIC` (SVG 200×200, trazo blanco 9 px, acentos coral) y, mejor, su animación propia en `AN` (html + init + upd(t)), siguiendo los existentes.
- Animación (motor v2): cada icono tiene su propia animación (váter que tira de la cadena, batido que se agita, fibras que se rompen y se reparan con `{"repair": true}`, cristales que pinchan y se rompen bajo el sello, llama, vaso con azúcar, mancuerna en excéntrica, calendario, plato con vapor...). Transiciones entre escenas, cámara en movimiento, partículas, sacudidas en los impactos y subtítulos palabra a palabra van solos. Parámetros extra: `trans` ("left"|"right"|"up"|"punch") para forzar la transición, `drain: true` en `clock` (el anillo se vacía), `tick: false` en `chips` (sin checks), `intense` en iconos de `vs`. Antes de renderizar, `node engine/preview.mjs X.json /tmp/p 0.12,0.4,0.9,1.8` y mira que ninguna escena se quede quieta; objetivo: movimiento continuo en toda la escena, no solo al entrar.
- Carrusel (en pausa desde el 5 nov): `engine/carousel.mjs` sigue disponible si Javier lo vuelve a pedir.

## 5. Producción (rutas)
- PC (device_bash): la carpeta del proyecto es `Videos\repe` (antes «Munster Gym»). Según la sesión está montada en `$HOME/mnt/repe` o en `$HOME/mnt/Videos/repe` (mira `ls $HOME/mnt/`); aquí se escribe `$REPE`. Dentro: `repe/engine`, `repe/content`, `work/`, claves en `.repe/` (**nunca** imprimirlas, copiarlas al repo ni a mensajes).
- Nube: Playwright + ffmpeg ya instalados. Desde la nube no se llega a Google ni a GitHub mientras la sesión está vinculada al PC: **la voz y la subida se hacen en el PC**; el render en la nube.
- Pasos por vídeo:
  1. Escribe el JSON en la nube y pásalo al PC con `device_commit_files` usando **siempre una carpeta nueva** en `/mnt/user-data/outputs/sync_<hora>/` (reutilizar una ruta puede dejar la versión vieja en el PC). Comprueba con `grep` en el PC que llegó.
  2. PC: `cd "$REPE/repe" && python3 engine/tts_pc.py content/FECHA/X.json ../work/FECHA/X_voz_raw.wav gemini-3.8-flash-tts Achird` (exit 3 = cupo agotado → repetir con `gemini-3.8-flash-lite-tts`). Cupo gratis: 10 peticiones/día por modelo, se renueva a las 9:00. Una petición = un vídeo entero; no gastes peticiones en pruebas.
     - **Ojo: el modelo bueno suele leer en voz alta las instrucciones antes del guion (unos 17 s y una pausa larga).** Antes de alinear, busca la pausa larga (~1 s) antes del gancho con `silencedetect` y recorta con `ffmpeg -ss` hasta ahí; comprueba con el audio de pitidos que la escena 1 es el gancho. Las pistas de Gemini fallan en ese caso: usa silencios + verificación.
     - Recetas fijas (no cambiarlas): modelo bueno = instrucciones en español + guion (la prueba que eligió Javier); modelo ligero = guion seguido + `speech_metadata.style` "Castilian Spanish accent from Spain, casual, witty and confident, fast upbeat social-media pace" (la del vídeo 1, aprobada). `tts_pc.py` ya aplica la que toca.
  3. PC: pistas de tiempo con Gemini: `python3 engine/align_pc.py content/FECHA/X.json ../work/FECHA/X_voz_raw.wav ../work/FECHA/X_hints.json`.
  4. Pasa a la nube (device_stage_files) la voz, las pistas y, si hace falta, el motor (`tar czf ../work/engine.tgz -C . engine`); descomprime en `/home/claude/repe/`.
  5. Nube: copia la voz como `work/X/voz_raw.wav` → `python3 engine/build.py ingest X.json work/X` → `align X.json work/X --hints X_hints.json`.
  6. **Comprobación obligatoria de subtítulos:** nube `python3 engine/segcheck.py X.json work/X X_seg.wav` → pásalo al PC → PC `python3 engine/verify_pc.py content/FECHA/X.json ../work/FECHA/X_seg.wav`. Todas las escenas deben salir OK (un "REVISAR" solo por números escritos con cifra es falso aviso). Si una frase se cuela en la escena vecina, busca el corte correcto (silencios con `build.silences(..., "-25dB", 0.04)` o el mínimo de energía), prueba cortes con un audio de pitidos y vuelve a verificar; corrige `tiempos.json` (start = corte + 0.12). Si la voz dice una palabra distinta al guion, ajusta `say` y `sub` a lo que dice.
  7. Nube: `render` → `mix ... salida.mp4` → `stills` y **mira `sheet.jpg`** antes de dar el vídeo por bueno.
  8. Carrusel: `node engine/carousel.mjs carrusel.json work/carrusel` y mira las diapositivas.
  9. Pasa los finales al PC (`device_commit_files`, carpeta `Videos/repe/FECHA/`) y súbelos: `python3 engine/push_pc.py "mensaje" "../FECHA/x.mp4" videos/FECHA-tema.mp4 ...` → devuelve las URLs raw (deben dar 200).
  10. Envía a Javier los vídeos y el carrusel (SendUserFile) con el copy.

## 6. Publicación (Metricool, blogId 7824439, Europe/Madrid)
- Reel: providers instagram, `instagramData {type: REEL, showReelOnFeed: true, isAiGenerated: true}`, `videoCoverMilliseconds` en el gancho.
- Short: providers youtube, `youtubeData {title, type: short, privacy: public, tags, category: SPORTS, madeForKids: false, isAiGeneratedContent: true}`; texto con `#shorts`.
- Para cambiar el vídeo de un post ya programado: `updateScheduledPost` con la nueva URL (Metricool guarda su propia copia; cambiar el archivo en GitHub no basta).
- TikTok: providers tiktok, el mismo vídeo, `tiktokData {title (obligatorio: el gancho, corto), privacyOption: PUBLIC_TO_EVERYONE, autoAddMusic: false, isAigc: true}` y el mismo `videoCoverMilliseconds` que el Reel. Copy más corto: gancho, 2-3 líneas con el dato, CTA y 5-7 hashtags (incluye #gymtok).
- Threads: providers threads, `threadsData {allowedCountryCodes: []}`, el mismo vídeo. Texto de 500 caracteres como máximo: gancho, 2-3 líneas con el dato y una pregunta que invite a contestar. Sin hashtags (Threads solo admite una etiqueta de tema por post).
- Cada red va en su propio post (Reel, TikTok, Short y Threads por separado) para que lleve su copy.
- **Metricool es de pago desde el 4 nov 2026: publicaciones ilimitadas.** Programa siempre todas las piezas en todas sus redes; no hace falta contar publicaciones.
- Copy: gancho en la primera línea, 3-4 líneas con emojis y el dato clave, CTA, 6-9 hashtags en español.

## 7. Registro
Añade cada pieza a `historial.json` (fecha, hora, tipo, tema, título, ids de Metricool, modelo de voz) y súbelo con `push_pc.py`.
