/*!
 * repe. — Toni, el personaje del canal (rig 2D por piezas) · v1.1
 * -----------------------------------------------------------------
 * Sin dependencias. Navegador o Playwright (motor de vídeos).
 *
 *   const toni = RepeToni.create({ view: 'side' });   // 'front' (de frente) o 'side' (perfil, mira a la derecha)
 *   escenaSvg.appendChild(toni.g);                    // o document.body.appendChild(toni.svg)
 *   toni.set(RepeToni.actions.walk(t, { x0: -300 }));  // cada fotograma: pose en función del tiempo t (s)
 *
 * Determinista: la misma t da el mismo fotograma (render fotograma a fotograma).
 * Unidades: ~620 u de alto; los pies tocan y = 0 del grupo raíz (salvo pivot:'pelvis').
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- colores
  const C = {
    line: '#1A1419',
    skin: '#EDB38A', skinLine: '#B97A57', skinFar: '#CF9670', skinFarLine: '#A26849',
    hair: '#4A2C1E', hairLight: '#6E4632', beard: '#5A3826',
    tank: '#FE594D', tankShade: '#E2463B', tankLine: '#B5342B', tankFar: '#D9453A',
    shorts: '#3A3846', shortsLine: '#1F1E27', shortsFar: '#2E2C38',
    shoe: '#FFFFFF', shoeShade: '#DEDCE6', sole: '#FE594D', sock: '#F3F3F5', sockFar: '#D3D3DA',
    band: '#FFFFFF', eye: '#FFFFFF', pupil: '#1A1419', mouth: '#5C1824', tongue: '#F0788A', teeth: '#FFFFFF',
    hl: '#C8F135', hlLine: '#7E9C10',
    metal: '#C9CCD4', metalDark: '#8A8E99', plate: '#ECEAF1', plateRing: '#FE594D', bench: '#4A4857', benchPad: '#FE594D',
    sweat: '#8FD9FF', white: '#FFFFFF'
  };
  const LW = 6;     // contorno
  const DW = 3.5;   // líneas interiores
  const NS = 'http://www.w3.org/2000/svg';

  // Modo de dibujo: 'normal' (relleno + contorno), 'outline' (solo silueta gruesa), 'fill' (solo relleno + detalles).
  // Las cadenas de brazo/pierna se dibujan en dos pasadas (outline y fill) para que las articulaciones no tengan costuras.
  let MODE = 'normal';
  const fo = (fill) => MODE === 'outline'
    ? `fill="${C.line}" stroke="${C.line}" stroke-width="${LW * 2}" stroke-linejoin="round"`
    : MODE === 'fill' ? `fill="${fill}" stroke="none"` : `fill="${fill}" stroke="${C.line}" stroke-width="${LW}" stroke-linejoin="round"`;
  const det = (col, w) => MODE === 'outline' ? 'fill="none" stroke="none"'
    : `fill="none" stroke="${col}" stroke-width="${w || DW}" stroke-linecap="round" stroke-linejoin="round"`;
  const hl = (key, d) => MODE === 'outline' ? '' : `<path data-hl="${key}" d="${d}" fill="${C.hl}" stroke="${C.hlLine}" stroke-width="3" opacity="0"/>`;
  // accesorios: siempre con su propio contorno (no se funden con la mano)
  const po = (fill) => MODE === 'outline' ? 'fill="none" stroke="none"' : `fill="${fill}" stroke="${C.line}" stroke-width="${LW - 1}" stroke-linejoin="round"`;

  function symbolPaths(color) {
    return `<g transform="translate(-100 -100)">
      <path d="M 38.94 89.24 A 62 62 0 0 1 147.49 60.15" stroke="${color}" stroke-width="30" fill="none"/>
      <path d="M 170.47 40.87 L 169.35 86.19 L 124.51 79.43 Z" fill="${color}" stroke="${color}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M 161.06 110.76 A 62 62 0 0 1 52.51 139.85" stroke="${color}" stroke-width="30" fill="none"/>
      <path d="M 29.53 159.13 L 30.65 113.81 L 75.49 120.57 Z" fill="${color}" stroke="${color}" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="100" cy="100" r="22" fill="${color}"/></g>`;
  }

  // ================================================================ PIEZAS DE FRENTE
  // Brazo/pierna izquierdos de pantalla; los derechos son los mismos espejados.
  const F = {};
  // Formas del brazo de frente (misma estructura de trazado para poder transformarse suavemente)
  const ARM_F = {
    normal: { body: 'M -48 6 C -66 40, -62 94, -42 126 L 34 126 C 50 98, 54 52, 40 8 C 30 -30, -40 -30, -48 6 Z',
      biceps: 'M -12 50 C 12 46, 38 58, 36 86 C 34 106, 8 118, -8 112 C -22 96, -24 66, -12 50 Z',
      triceps: 'M -46 50 C -58 74, -54 100, -40 120 C -30 100, -30 74, -34 52 Z',
      lines: 'M -18 48 C -32 70, -28 96, -10 114 M 22 52 C 32 68, 32 86, 24 104' },
    flex: { body: 'M -42 4 C -96 22, -100 92, -50 120 L 32 126 C 44 96, 48 50, 40 6 C 30 -30, -36 -30, -42 4 Z',
      biceps: 'M -34 48 C -60 44, -90 60, -86 86 C -84 104, -64 116, -50 114 C -30 96, -26 70, -34 48 Z',
      triceps: 'M 36 46 C 42 66, 40 94, 28 118 C 20 100, 20 70, 18 46 Z',
      lines: 'M -30 48 C -26 70, -26 90, -36 110 M 16 48 C 20 70, 20 92, 14 112' }
  };
  const NUM_RE = /-?\d+(?:\.\d+)?/g;
  function lerpPath(a, b, k) {
    if (k <= 0) return a; if (k >= 1) return b;
    const nb = b.match(NUM_RE); let i = 0;
    return a.replace(NUM_RE, (m) => { const v = +m + (+nb[i++] - +m) * k; return (Math.round(v * 10) / 10).toString(); });
  }
  F.upperArm = (s) => `
    <path data-armpath="body" d="${ARM_F.normal.body}" ${fo(s.skin)}/>
    ${MODE === 'outline' ? '' : `<path data-armpath="triceps" data-hl="triceps" d="${ARM_F.normal.triceps}" fill="${C.hl}" stroke="${C.hlLine}" stroke-width="3" opacity="0"/>
    <path data-armpath="biceps" data-hl="biceps" d="${ARM_F.normal.biceps}" fill="${C.hl}" stroke="${C.hlLine}" stroke-width="3" opacity="0"/>`}
    <path data-armpath="lines" d="${ARM_F.normal.lines}" ${det(s.line)}/>
    <path data-armpeak d="M -68 64 C -74 72, -74 82, -68 90" ${det(s.line, 3)} opacity="0"/>`;
  // Deltoides: cuelga del torso y gira la mitad que el brazo (el hombro se deforma de forma natural)
  F.delt = (s) => `
    <path d="M -54 4 C -58 -26, -36 -46, -8 -46 C 20 -46, 42 -28, 42 0 C 42 22, 26 42, -6 46 C -36 46, -52 30, -54 4 Z" ${fo(s.skin)}/>
    ${hl('delts', 'M -48 4 C -52 -22, -32 -40, -8 -40 C 16 -40, 36 -24, 36 0 C 36 18, 22 36, -6 40 C -32 40, -46 26, -48 4 Z')}
    <path d="M -46 22 C -28 38, 8 40, 30 24" ${det(s.line)}/>`;
  F.forearm = (s) => `
    <circle cx="-2" cy="0" r="38" ${fo(s.skin)}/>
    <path d="M -40 -4 C -52 30, -40 82, -26 110 L 24 110 C 38 82, 46 30, 36 -4 Z" ${fo(s.skin)}/>
    ${hl('forearms', 'M -34 4 C -44 34, -34 76, -22 100 L 20 100 C 32 76, 38 34, 28 4 Z')}
    <path d="M -22 24 C -32 52, -26 82, -16 100" ${det(s.line)}/>`;
  const fistF = (s) => `
      <path d="M -30 -6 C -38 12, -36 44, -24 58 C -8 68, 18 66, 28 52 C 36 36, 34 8, 28 -6 Z" ${fo(s.skin)}/>
      <path d="M -14 38 L -14 56 M 0 40 L 0 60 M 14 38 L 14 56" ${det(s.line)}/>`;
  F.hand = (s) => `
    <g data-prop="dumbbell" style="display:none">
      <rect x="-62" y="18" width="124" height="16" rx="7" ${po(C.metal)}/>
      <rect x="-86" y="-12" width="28" height="76" rx="8" ${po(C.plate)}/>
      <rect x="58" y="-12" width="28" height="76" rx="8" ${po(C.plate)}/>
      <path d="M -72 -4 L -72 56 M 72 -4 L 72 56" ${det(C.plateRing, 5)}/>
    </g>
    <g data-hand="fist">${fistF(s)}
      <path d="M 20 2 C 36 8, 40 30, 26 38 C 18 30, 14 14, 20 2 Z" ${fo(s.skin)}/>
      <path d="M 20 4 C 34 10, 36 28, 26 36" ${det(s.line, 3)}/>
    </g>
    <g data-hand="open" style="display:none">
      <path d="M -34 -6 C -42 14, -42 36, -38 46 C -40 62, -40 72, -34 78 C -28 82, -22 80, -22 74 L -22 82 C -18 88, -8 88, -6 80 L -6 84 C -2 90, 8 90, 8 82 L 8 76 C 12 82, 22 80, 22 72 L 22 44 C 32 30, 34 10, 28 -6 Z" ${fo(s.skin)}/>
      <path d="M -22 50 L -22 74 M -6 52 L -6 80 M 8 50 L 8 76" ${det(s.line)}/>
      <path d="M 24 4 C 42 2, 54 16, 50 30 C 46 36, 38 34, 32 26 L 24 18 Z" ${fo(s.skin)}/>
    </g>
    <g data-hand="thumb" style="display:none">${fistF(s)}
      <path d="M 12 44 C 14 66, 18 90, 28 98 C 38 104, 46 96, 42 84 C 38 70, 34 56, 30 42 Z" ${fo(s.skin)}/>
      <path d="M 14 46 C 18 60, 22 74, 26 84" ${det(s.line, 3)}/>
    </g>
    <g data-hand="point" style="display:none">
      <path d="M -30 -6 C -38 12, -36 44, -24 58 C -8 68, 18 66, 28 52 C 36 36, 34 8, 28 -6 Z" ${fo(s.skin)}/>
      <path d="M -14 38 L -14 56 M 0 40 L 0 60" ${det(s.line)}/>
      <path d="M 6 44 C 8 70, 10 96, 14 108 C 18 116, 28 114, 28 104 C 28 88, 28 66, 26 46 Z" ${fo(s.skin)}/>
      <path d="M 20 2 C 36 8, 40 30, 26 38 C 18 30, 14 14, 20 2 Z" ${fo(s.skin)}/>
    </g>`;
  F.torso = (s) => `
    <path d="M -34 -228 L -32 -270 L 32 -270 L 34 -228 Z" ${fo(s.skin)}/>
    <path d="M -18 -236 L -10 -262 M 18 -236 L 10 -262" ${det(s.line)}/>
    <path d="M -52 2 C -66 -40, -100 -95, -124 -140 C -140 -172, -150 -196, -140 -214 C -114 -228, -68 -230, -36 -240 L 36 -240 C 68 -230, 114 -228, 140 -214 C 150 -196, 140 -172, 124 -140 C 100 -95, 66 -40, 52 2 Z" ${fo(s.skin)}/>
    ${hl('traps', 'M -32 -238 C -60 -228, -100 -224, -130 -214 C -100 -214, -70 -216, -40 -224 Z M 32 -238 C 60 -228, 100 -224, 130 -214 C 100 -214, 70 -216, 40 -224 Z')}
    <path d="M -38 -234 C -68 -224, -102 -222, -126 -214 M 38 -234 C 68 -224, 102 -222, 126 -214" ${det(s.line)}/>
    ${hl('lats', 'M -126 -146 C -106 -100, -82 -60, -58 -18 C -66 -50, -86 -88, -106 -126 Z M 126 -146 C 106 -100, 82 -60, 58 -18 C 66 -50, 86 -88, 106 -126 Z')}
    <path d="M -56 6 C -70 -40, -102 -92, -118 -140 C -106 -150, -94 -164, -88 -186 L -72 -230 L -46 -234 C -40 -198, 40 -198, 46 -234 L 72 -230 L 88 -186 C 94 -164, 106 -150, 118 -140 C 102 -92, 70 -40, 56 6 Z" ${fo(s.tank)}/>
    <path d="M -50 -2 C -62 -40, -90 -88, -106 -128" ${det(s.tankShade, 10)}/>
    ${hl('chest', 'M -102 -142 C -100 -172, -48 -194, -6 -188 L -4 -144 C -30 -122, -74 -120, -102 -142 Z M 102 -142 C 100 -172, 48 -194, 6 -188 L 4 -144 C 30 -122, 74 -120, 102 -142 Z')}
    ${hl('abs', 'M -34 -114 L -4 -116 L -4 -88 L -32 -86 Z M 4 -116 L 34 -114 L 32 -86 L 4 -88 Z M -32 -80 L -4 -82 L -4 -54 L -30 -52 Z M 4 -82 L 32 -80 L 30 -52 L 4 -54 Z M -30 -46 L -4 -48 L -4 -18 L -26 -18 Z M 4 -48 L 30 -46 L 26 -18 L 4 -18 Z')}
    <path d="M -102 -140 C -72 -118, -30 -120, -4 -142 M 102 -140 C 72 -118, 30 -120, 4 -142 M 0 -198 L 0 -146" ${det(C.tankLine)}/>
    <g transform="translate(54 -168) scale(0.26)">${symbolPaths(C.white)}</g>
    <path d="M -40 -10 C -14 -4, 14 -4, 40 -10" ${det(C.tankLine)}/>`;
  F.shorts = (s) => `
    <path d="M -64 -10 C -72 14, -92 46, -102 88 L -6 96 L 0 68 L 6 96 L 102 88 C 92 46, 72 14, 64 -10 Z" ${fo(s.shorts)}/>
    <path d="M -62 4 L 62 4" ${det(C.shortsLine, 4)}/>
    <path d="M -97 74 L -8 82 M 97 74 L 8 82" ${det(C.shortsLine, 3)}/>
    <path d="M -84 30 C -80 46, -76 60, -74 74 M 84 30 C 80 46, 76 60, 74 74" ${det(C.shortsLine, 3)}/>
    <path d="M -6 6 L -10 22 M 6 6 L 10 22" ${det(C.white, 3)}/>`;
  F.thigh = (s) => `
    <path d="M -42 -12 C -54 22, -50 70, -32 100 L 30 100 C 46 70, 50 22, 38 -12 Z" ${fo(s.skin)}/>
    ${hl('quads', 'M -36 30 C -44 50, -40 76, -26 94 L 24 94 C 36 74, 40 50, 32 30 Z')}
    <path d="M -12 34 C -26 54, -22 80, -8 92 M 14 40 C 24 58, 22 78, 14 90" ${det(s.line)}/>`;
  F.shin = (s) => `
    <circle cx="-1" cy="0" r="30" ${fo(s.skin)}/>
    <path d="M -30 -2 C -44 28, -38 58, -20 84 L 18 84 C 36 58, 42 28, 28 -2 Z" ${fo(s.skin)}/>
    ${hl('calves', 'M -28 6 C -40 30, -36 52, -22 70 L -6 70 C -10 46, -12 24, -10 6 Z M 26 6 C 38 30, 34 52, 20 70 L 6 70 C 10 46, 12 24, 10 6 Z')}
    <path d="M -21 62 L 19 62 L 18 92 L -20 92 Z" ${fo(s.sock)}/>
    <path d="M -20 70 L 18 70" ${det(C.sole, 4)}/>`;
  F.foot = (s) => `
    <path d="M -34 -6 C -46 6, -48 26, -36 34 L 34 34 C 46 26, 44 6, 32 -6 C 20 -12, -22 -12, -34 -6 Z" ${fo(s.shoe)}/>
    <path d="M -40 26 L 40 26 L 37 38 L -38 38 Z" ${fo(C.sole)}/>
    <path d="M -12 -2 L 10 -2 M -14 8 L 12 8" ${det(C.line, 3.5)}/>`;
  F.head = (s) => `
    <ellipse cx="-47" cy="-52" rx="10" ry="15" ${fo(s.skin)}/>
    <ellipse cx="47" cy="-52" rx="10" ry="15" ${fo(s.skin)}/>
    <path d="M -46 -52 C -50 -90, -34 -116, 0 -118 C 34 -116, 50 -90, 46 -52 C 48 -26, 40 -6, 20 4 C 10 8, -10 8, -20 4 C -40 -6, -48 -26, -46 -52 Z" ${fo(s.skin)}/>
    <path d="M -8 0 C -3 3, 3 3, 8 0" ${det(s.line, 3)}/>
    <path d="M -50 -66 C -56 -104, -36 -134, -2 -136 C 36 -136, 56 -110, 50 -66 C 46 -80, 42 -88, 36 -92 C 14 -98, -14 -98, -36 -92 C -42 -88, -46 -80, -50 -66 Z" ${fo(C.hair)}/>
    <path d="M -30 -118 C -20 -124, -8 -126, 4 -124 M 8 -128 C 20 -126, 30 -120, 38 -112" ${det(C.hairLight, 4)}/>
    <path d="M -49 -82 C -30 -92, 30 -92, 49 -82 L 48 -70 C 30 -80, -30 -80, -48 -70 Z" ${fo(C.band)}/>
    <path d="M -48 -76 C -30 -86, 30 -86, 48 -76" ${det(C.sole, 3.5)}/>
    <g data-eye="L" transform="translate(-17 -50)">
      <ellipse rx="8.5" ry="10.5" fill="${C.eye}" stroke="${C.line}" stroke-width="3.5"/>
      <circle data-pupil r="5" fill="${C.pupil}"/>
    </g>
    <g data-eye="R" transform="translate(17 -50)">
      <ellipse rx="8.5" ry="10.5" fill="${C.eye}" stroke="${C.line}" stroke-width="3.5"/>
      <circle data-pupil r="5" fill="${C.pupil}"/>
    </g>
    <path data-lid="L" d="" fill="${s.skin}" stroke="${C.line}" stroke-width="3.5"/>
    <path data-lid="R" d="" fill="${s.skin}" stroke="${C.line}" stroke-width="3.5"/>
    <path data-lidline="L" d="" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
    <path data-lidline="R" d="" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
    <path data-brow="L" d="" ${det(C.hair, 7.5)}/>
    <path data-brow="R" d="" ${det(C.hair, 7.5)}/>
    <path d="M -1 -46 C 6 -36, 7 -31, 0 -29" ${det(s.line)}/>
    <g data-mouth></g>`;

  // ================================================================ PIEZAS DE PERFIL (mira a +x)
  const S = {};
  S.upperArm = (s) => `
    <path d="M -42 6 C -56 48, -48 98, -34 126 L 30 126 C 54 96, 58 50, 40 6 C 30 -30, -32 -30, -42 6 Z" ${fo(s.skin)}/>
    ${hl('triceps', 'M -40 20 C -52 54, -46 96, -32 120 L -12 120 C -18 90, -18 50, -14 20 Z')}
    ${hl('biceps', 'M 2 26 C 30 24, 52 52, 48 86 C 44 108, 24 120, 4 116 C 0 90, -2 52, 2 26 Z')}
    <path d="M 0 30 C 6 62, 6 94, 0 116" ${det(s.line)}/>`;
  S.delt = (s) => `
    <path d="M -44 2 C -46 -28, -24 -46, 0 -46 C 24 -46, 46 -28, 44 2 C 44 28, 24 46, 0 46 C -24 46, -44 28, -44 2 Z" ${fo(s.skin)}/>
    ${hl('delts', 'M -38 2 C -40 -22, -20 -40, 0 -40 C 20 -40, 40 -22, 38 2 C 38 22, 20 40, 0 40 C -20 40, -38 22, -38 2 Z')}
    <path d="M -32 28 C -14 40, 14 40, 32 28" ${det(s.line)}/>`;
  S.forearm = (s) => `
    <circle cx="0" cy="0" r="33" ${fo(s.skin)}/>
    <path d="M -31 -4 C -39 30, -31 82, -21 108 L 21 108 C 33 78, 43 30, 33 -4 Z" ${fo(s.skin)}/>
    ${hl('forearms', 'M -26 4 C -32 34, -26 76, -16 100 L 16 100 C 26 74, 34 34, 26 4 Z')}
    <path d="M 12 22 C 20 48, 16 78, 10 98" ${det(s.line)}/>`;
  const fistS = (s) => `
      <path d="M -26 -6 C -32 14, -30 44, -16 56 C 2 64, 24 56, 28 38 C 32 18, 30 0, 22 -8 Z" ${fo(s.skin)}/>
      <path d="M 26 22 L 12 22 M 26 36 L 10 36" ${det(s.line)}/>`;
  S.hand = (s) => `
    <g data-prop="dumbbell" style="display:none">
      <circle cx="0" cy="27" r="42" ${po(C.plate)}/>
      ${MODE === 'outline' ? '' : `<circle cx="0" cy="27" r="29" fill="none" stroke="${C.plateRing}" stroke-width="6"/>`}
      <circle cx="0" cy="27" r="9" ${po(C.metal)}/>
    </g>
    <g data-hand="fist">${fistS(s)}
      <path d="M 14 6 C 30 4, 38 18, 32 28 C 24 30, 16 22, 14 6 Z" ${fo(s.skin)}/>
      <path d="M 16 8 C 30 6, 36 18, 32 26" ${det(s.line, 3)}/>
    </g>
    <g data-hand="open" style="display:none">
      <path d="M -24 -6 C -30 14, -28 40, -20 56 L -6 92 C -2 100, 10 98, 10 90 L 4 60 L 14 94 C 18 102, 30 100, 28 90 L 22 58 L 26 66 C 30 74, 40 70, 38 62 L 30 30 C 30 10, 26 -2, 20 -8 Z" ${fo(s.skin)}/>
      <path d="M 18 4 C 36 0, 46 14, 42 24 C 36 30, 26 24, 20 16 Z" ${fo(s.skin)}/>
    </g>
    <g data-hand="thumb" style="display:none">${fistS(s)}
      <path d="M 22 6 C 42 0, 60 -2, 66 6 C 70 14, 62 22, 50 22 C 42 22, 32 22, 24 24 Z" ${fo(s.skin)}/>
    </g>
    <g data-hand="point" style="display:none">${fistS(s)}
      <path d="M 20 40 C 22 64, 24 88, 26 100 C 28 110, 40 110, 40 100 C 40 84, 38 62, 34 38 Z" ${fo(s.skin)}/>
    </g>`;
  S.torso = (s) => `
    <path d="M 2 -232 L 6 -270 L 46 -270 L 50 -236 Z" ${fo(s.skin)}/>
    <path d="M 34 -242 L 42 -264" ${det(s.line)}/>
    <path d="M -38 2 C -58 -36, -86 -96, -84 -146 C -82 -190, -58 -226, -18 -240 L 30 -246 C 72 -242, 114 -220, 130 -184 C 140 -154, 128 -124, 100 -110 C 76 -84, 58 -40, 48 2 Z" ${fo(s.skin)}/>
    ${hl('traps', 'M -14 -238 C 6 -244, 28 -246, 44 -240 C 30 -230, 6 -226, -16 -226 Z')}
    <path d="M -40 6 C -60 -36, -88 -96, -86 -146 C -84 -178, -70 -206, -48 -224 L -26 -232 L -6 -220 C 28 -210, 62 -210, 90 -218 L 106 -208 C 126 -188, 136 -160, 128 -134 C 118 -120, 106 -114, 100 -110 C 76 -82, 58 -40, 50 6 Z" ${fo(s.tank)}/>
    ${hl('lats', 'M -84 -150 C -86 -116, -76 -78, -58 -38 C -52 -70, -50 -110, -56 -150 Z')}
    ${hl('back', 'M -84 -152 C -84 -186, -66 -214, -40 -226 C -46 -196, -54 -168, -56 -150 Z')}
    ${hl('chest', 'M 126 -136 C 136 -160, 128 -192, 106 -206 C 82 -214, 58 -212, 42 -204 C 36 -172, 44 -140, 60 -128 C 82 -116, 108 -118, 126 -136 Z')}
    ${hl('abs', 'M 86 -102 L 98 -102 L 90 -78 L 78 -78 Z M 76 -70 L 88 -70 L 80 -46 L 68 -46 Z M 66 -38 L 78 -38 L 70 -14 L 58 -14 Z')}
    <path d="M 126 -136 C 106 -118, 82 -116, 62 -126" ${det(C.tankLine)}/>
    <path d="M -70 -50 C -80 -90, -82 -126, -78 -160" ${det(s.tankShade, 10)}/>
    <path d="M -36 -10 C -10 -4, 22 -4, 44 -10" ${det(C.tankLine)}/>`;
  S.shorts = (s) => `
    <path d="M -46 -10 C -68 10, -72 48, -60 76 L 50 80 C 56 46, 54 10, 48 -10 Z" ${fo(s.shorts)}/>
    ${hl('glutes', 'M -50 4 C -66 22, -68 50, -58 70 L -30 70 C -36 50, -36 24, -30 6 Z')}
    <path d="M -48 4 L 48 4" ${det(C.shortsLine, 4)}/>
    <path d="M -58 64 L 48 68" ${det(C.shortsLine, 3)}/>`;
  S.thigh = (s) => `
    <path d="M -38 -12 C -52 26, -46 74, -28 102 L 26 102 C 48 74, 56 30, 42 -12 Z" ${fo(s.skin)}/>
    <path d="M -46 -16 C -54 4, -54 18, -50 30 L 50 34 C 56 18, 56 2, 48 -16 Z" ${fo(s.shorts)}/>
    <path d="M -48 22 L 50 26" ${det(C.shortsLine, 3)}/>
    ${hl('quads', 'M 6 6 C 34 10, 48 40, 40 70 C 36 86, 28 96, 18 98 C 10 70, 4 36, 6 6 Z')}
    ${hl('hams', 'M -34 10 C -44 40, -38 72, -24 96 L -6 96 C -10 66, -12 36, -10 10 Z')}
    <path d="M 4 36 C 14 56, 16 78, 12 94" ${det(s.line)}/>`;
  S.shin = (s) => `
    <circle cx="0" cy="0" r="28" ${fo(s.skin)}/>
    <path d="M -30 -2 C -52 24, -42 62, -18 88 L 16 88 C 22 60, 28 26, 26 -2 Z" ${fo(s.skin)}/>
    ${hl('calves', 'M -28 6 C -46 28, -40 56, -20 74 L -6 74 C -10 50, -10 26, -8 6 Z')}
    <path d="M -19 66 L 17 66 L 16 94 L -18 94 Z" ${fo(s.sock)}/>
    <path d="M -19 74 L 16 74" ${det(C.sole, 4)}/>`;
  S.foot = (s) => `
    <path d="M -24 -8 C -32 6, -32 24, -28 32 L 62 32 C 72 28, 72 14, 60 8 C 44 2, 28 -2, 16 -10 C 4 -16, -16 -16, -24 -8 Z" ${fo(s.shoe)}/>
    <path d="M -30 24 L 64 24 C 72 26, 72 34, 62 38 L -28 38 Z" ${fo(C.sole)}/>
    <path d="M 8 -4 L 18 6 M 18 -2 L 28 8" ${det(C.line, 3.5)}/>`;
  S.head = (s) => `
    <ellipse cx="-8" cy="-50" rx="11" ry="15" ${fo(s.skin)}/>
    <path d="M -44 -58 C -46 -96, -24 -120, 6 -120 C 34 -120, 50 -100, 52 -74 L 54 -58 L 64 -42 C 70 -36, 68 -30, 58 -28 L 58 -18 C 60 -12, 58 -4, 52 0 C 46 8, 30 10, 14 6 C 0 4, -14 -6, -22 -16 C -36 -26, -44 -40, -44 -58 Z" ${fo(s.skin)}/>
    <path d="M -4 -26 C 6 -12, 20 -4, 34 -2" ${det(s.line, 3)}/>
    <path d="M -46 -62 C -50 -100, -26 -126, 8 -126 C 38 -124, 54 -106, 54 -82 C 44 -88, 30 -92, 16 -92 C 0 -92, -14 -86, -22 -78 C -28 -70, -36 -62, -46 -62 Z" ${fo(C.hair)}/>
    <path d="M -10 -116 C 4 -122, 20 -122, 34 -116" ${det(C.hairLight, 4)}/>
    <path d="M -45 -78 C -20 -92, 30 -96, 54 -86 L 54 -74 C 30 -84, -20 -80, -44 -66 Z" ${fo(C.band)}/>
    <path d="M -44 -72 C -20 -86, 30 -90, 54 -80" ${det(C.sole, 3.5)}/>
    <g data-eye="R" transform="translate(36 -50)">
      <ellipse rx="7.5" ry="10.5" fill="${C.eye}" stroke="${C.line}" stroke-width="3.5"/>
      <circle data-pupil r="4.8" fill="${C.pupil}"/>
    </g>
    <path data-lid="R" d="" fill="${s.skin}" stroke="${C.line}" stroke-width="3.5"/>
    <path data-lidline="R" d="" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
    <path data-brow="R" d="" ${det(C.hair, 7.5)}/>
    <g data-mouth></g>`;

  const NEAR = { skin: C.skin, line: C.skinLine, tank: C.tank, tankShade: C.tankShade, shorts: C.shorts, sock: C.sock, shoe: C.shoe };
  const FAR = { skin: C.skinFar, line: C.skinFarLine, tank: C.tankFar, tankShade: C.tankShade, shorts: C.shortsFar, sock: C.sockFar, shoe: C.shoeShade };

  // ================================================================ ESQUELETOS
  // Ángulos "anatómicos" en grados:
  //  frente: arm.sh = separación lateral (0 abajo, 90 en cruz, 180 arriba); arm.el = flexión del codo (sigue el mismo giro);
  //          leg.hip = separación; leg.kn / leg.an = flexión. Los lados R se espejan solos.
  //  perfil: arm.sh = flexión del hombro (+ delante, − detrás); arm.el = flexión del codo; leg.hip = flexión de cadera (+ delante);
  //          leg.kn = flexión de rodilla (+ hacia atrás); leg.an = flexión dorsal del tobillo (+ punta arriba).
  const d0 = (v) => (v || 0);
  const lift = (sh) => Math.max(0, (sh || 0) - 70);
  const shF = (side) => (p) => { const a = d0(side === 'L' ? p.armL.sh : p.armR.sh); return [(side === 'L' ? -1 : 1) * (150 - 0.1 * lift(a)), -204 - 0.16 * lift(a)]; };
  const shS = (x, y, k) => (p) => { const a = d0(p[k].sh); return [x - 0.05 * lift(a), y - 0.14 * lift(a)]; };
  const SKEL = {
    front: { id: 'root', children: [
      { id: 'pelvis', off: [0, -250], ang: (p) => d0(p.hips), children: [
        { id: 'legL', chain: true, off: [-40, 35], ang: (p) => d0(p.legL.hip), draw: F.thigh, children: [
          { id: 'kneeL', off: [0, 98], ang: (p) => d0(p.legL.kn), draw: F.shin, children: [
            { id: 'ankleL', off: [0, 86], ang: (p) => d0(p.legL.an), draw: F.foot }] }] },
        { id: 'legR', chain: true, mirror: true, off: [40, 35], ang: (p) => -d0(p.legR.hip), draw: F.thigh, children: [
          { id: 'kneeR', off: [0, 98], ang: (p) => d0(p.legR.kn), draw: F.shin, children: [
            { id: 'ankleR', off: [0, 86], ang: (p) => d0(p.legR.an), draw: F.foot }] }] },
        { id: 'shorts', draw: F.shorts },
        { id: 'torso', off: [0, 0], ang: (p) => d0(p.torso), draw: F.torso, children: [
          { id: 'head', off: [0, -254], ang: (p) => d0(p.head), draw: F.head },
          { id: 'deltL', off: shF('L'), ang: (p) => 0.5 * d0(p.armL.sh), draw: F.delt },
          { id: 'deltR', mirror: true, off: shF('R'), ang: (p) => -0.5 * d0(p.armR.sh), draw: F.delt },
          { id: 'armL', chain: true, off: shF('L'), ang: (p) => d0(p.armL.sh), draw: F.upperArm, children: [
            { id: 'elbowL', off: [0, 122], ang: (p) => d0(p.armL.el), draw: F.forearm, children: [
              { id: 'wristL', off: [0, 104], ang: (p) => d0(p.armL.wr), draw: F.hand }] }] },
          { id: 'armR', chain: true, mirror: true, off: shF('R'), ang: (p) => -d0(p.armR.sh), draw: F.upperArm, children: [
            { id: 'elbowR', off: [0, 122], ang: (p) => d0(p.armR.el), draw: F.forearm, children: [
              { id: 'wristR', off: [0, 104], ang: (p) => d0(p.armR.wr), draw: F.hand }] }] }
        ] }
      ] }
    ] },
    side: { id: 'root', children: [
      { id: 'pelvis', off: [0, -250], ang: (p) => d0(p.hips), children: [
        { id: 'legFar', chain: true, far: true, off: [-4, 34], ang: (p) => -d0(p.legFar.hip), draw: S.thigh, children: [
          { id: 'kneeFar', off: [0, 100], ang: (p) => d0(p.legFar.kn), draw: S.shin, children: [
            { id: 'ankleFar', off: [0, 88], ang: (p) => -d0(p.legFar.an), draw: S.foot }] }] },
        { id: 'legNear', chain: true, off: [4, 36], ang: (p) => -d0(p.legNear.hip), draw: S.thigh, children: [
          { id: 'kneeNear', off: [0, 100], ang: (p) => d0(p.legNear.kn), draw: S.shin, children: [
            { id: 'ankleNear', off: [0, 88], ang: (p) => -d0(p.legNear.an), draw: S.foot }] }] },
        { id: 'shorts', draw: S.shorts },
        { id: 'torso', off: [0, 0], ang: (p) => d0(p.torso), children: [
          { id: 'deltFar', far: true, off: shS(-6, -202, 'armFar'), ang: (p) => -0.5 * d0(p.armFar.sh), draw: S.delt },
          { id: 'deltNear', off: shS(4, -198, 'armNear'), ang: (p) => -0.5 * d0(p.armNear.sh), draw: S.delt },
          { id: 'armFar', chain: true, far: true, off: shS(-6, -202, 'armFar'), ang: (p) => -d0(p.armFar.sh), draw: S.upperArm, children: [
            { id: 'elbowFar', off: [0, 122], ang: (p) => -d0(p.armFar.el), draw: S.forearm, children: [
              { id: 'wristFar', off: [0, 104], ang: (p) => -d0(p.armFar.wr), draw: S.hand }] }] },
          { id: 'torsoBody', draw: S.torso },
          { id: 'head', off: [24, -256], ang: (p) => d0(p.head), draw: S.head },
          { id: 'armNear', chain: true, off: shS(4, -198, 'armNear'), ang: (p) => -d0(p.armNear.sh), draw: S.upperArm, children: [
            { id: 'elbowNear', off: [0, 122], ang: (p) => -d0(p.armNear.el), draw: S.forearm, children: [
              { id: 'wristNear', off: [0, 104], ang: (p) => -d0(p.armNear.wr), draw: S.hand }] }] }
        ] }
      ] }
    ] }
  };
  const DEFS = {};
  for (const v of Object.keys(SKEL)) {
    DEFS[v] = {};
    (function index(n, parent) { DEFS[v][n.id] = Object.assign({ parent }, n); (n.children || []).forEach((c) => index(c, n.id)); })(SKEL[v], null);
  }
  const SOLE = { front: [[-36, 38], [36, 38]], side: [[-26, 38], [64, 38]] };
  const FEET = { front: ['ankleL', 'ankleR'], side: ['ankleFar', 'ankleNear'] };

  // ================================================================ POSES
  const LIMB = (o) => Object.assign({ sh: 0, el: 0, wr: 0, hand: 'fist', prop: null, flex: null }, o);
  const LEG = (o) => Object.assign({ hip: 0, kn: 0, an: 0 }, o);
  function basePose(view) {
    const p = { view, x: 0, y: 0, rot: 0, scale: 1, flip: false, pivot: 'feet',
      hips: 0, torso: 0, head: 0, breath: 0,
      face: { mouth: 'smile', open: 0, brows: 'neutral', browY: 0, look: [0, 0], blink: 0, lid: 0.18, wink: false },
      hl: {}, sweat: 0, sweatT: 0, bar: false };
    if (view === 'front') Object.assign(p, { armL: LIMB({ sh: 14, el: 10 }), armR: LIMB({ sh: 14, el: 10 }), legL: LEG({ hip: 4 }), legR: LEG({ hip: 4 }) });
    else Object.assign(p, { armFar: LIMB({ sh: -6, el: 12 }), armNear: LIMB({ sh: 4, el: 14 }), legFar: LEG(), legNear: LEG() });
    return p;
  }
  function merge(a, b) {
    if (b === undefined) return a;
    if (b === null || typeof b !== 'object' || Array.isArray(b)) return b;
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) out[k] = (a && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k];
    return out;
  }
  function lerpPose(a, b, k) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k;
    if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpPose(v, b[i], k));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const out = {};
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(key in a)) out[key] = b[key];
        else if (!(key in b)) out[key] = a[key];
        else out[key] = lerpPose(a[key], b[key], k);
      }
      return out;
    }
    return k < 0.5 ? a : b;
  }
  const ease = {
    linear: (k) => k,
    inOut: (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
  };
  // keyframes: [[t, poseParcial, easing], …] sobre la pose base de la vista
  function keys(view, frames, t, loop) {
    const base = basePose(view);
    const full = frames.map((f) => [f[0], merge(base, f[1]), f[2] || 'inOut']);
    const T = full[full.length - 1][0];
    if (loop && T > 0) t = ((t % T) + T) % T;
    if (t <= full[0][0]) return full[0][1];
    for (let i = 0; i < full.length - 1; i++) {
      const [t0, p0] = full[i]; const [t1, p1, e] = full[i + 1];
      if (t <= t1) return lerpPose(p0, p1, ease[e]((t - t0) / Math.max(1e-6, t1 - t0)));
    }
    return full[full.length - 1][1];
  }
  // mezcla suave entre dos poses de la misma vista (k de 0 a 1)
  function blend(poseA, poseB, k) {
    const v = poseA.view || poseB.view || 'side';
    return lerpPose(merge(basePose(v), poseA), merge(basePose(v), poseB), ease.inOut(Math.max(0, Math.min(1, k))));
  }

  // ================================================================ CINEMÁTICA (sin DOM)
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const rotM = (a) => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
  const trM = (x, y) => [1, 0, 0, 1, x, y];
  const scM = (x, y) => [x, 0, 0, y, 0, 0];
  function localMatrix(defs, p, id) {
    const n = defs[id];
    if (id === 'root') {
      let m = mul(mul(trM(p.x || 0, p.y || 0), rotM(p.rot || 0)), scM((p.flip ? -1 : 1) * (p.scale || 1), p.scale || 1));
      if (p.pivot === 'pelvis') m = mul(m, trM(0, 250));
      return m;
    }
    const off = typeof n.off === 'function' ? n.off(p) : (n.off || [0, 0]);
    let m = mul(trM(off[0], off[1]), rotM(n.ang ? n.ang(p) : 0));
    if (id === 'torso') { const b = p.breath || 0; m = mul(m, scM(1 + 0.012 * b, 1 + 0.02 * b)); }
    return m;
  }
  function worldMatrix(defs, p, id) {
    const ids = []; let cur = id; while (cur) { ids.unshift(cur); cur = defs[cur].parent; }
    let m = [1, 0, 0, 1, 0, 0];
    for (const jid of ids) { m = mul(m, localMatrix(defs, p, jid)); if (defs[jid].mirror) m = mul(m, scM(-1, 1)); }
    return m;
  }
  const apply2 = (m, pt) => [m[0] * pt[0] + m[2] * pt[1] + m[4], m[1] * pt[0] + m[3] * pt[1] + m[5]];
  function worldPoint(view, pose, id, pt) { return apply2(worldMatrix(DEFS[view], merge(basePose(view), pose), id), pt || [0, 0]); }
  // Apoya al personaje en el suelo: ajusta y para que la suela más baja toque groundY.
  // anchor: 'near'/'far' (perfil) o 'L'/'R' (frente) → además ajusta x para que ese tobillo quede en anchorX.
  function ground(pose, groundY, anchor, anchorX) {
    const view = pose.view || 'side';
    const full = merge(basePose(view), pose);
    let maxY = -1e9;
    for (const a of FEET[view]) for (const s of SOLE[view]) maxY = Math.max(maxY, apply2(worldMatrix(DEFS[view], full, a), s)[1]);
    const out = Object.assign({}, pose, { y: (pose.y || 0) + (groundY || 0) - maxY });
    if (anchor != null) {
      const id = view === 'side' ? (anchor === 'far' ? 'ankleFar' : 'ankleNear') : (anchor === 'R' ? 'ankleR' : 'ankleL');
      out.x = (pose.x || 0) + anchorX - apply2(worldMatrix(DEFS[view], full, id), [0, 0])[0];
    }
    return out;
  }

  // ================================================================ CARAS
  const BROWS = { neutral: [0, 0], up: [-8, -6], angry: [8, -6], sad: [-7, 6], cocky: [0, -10], focus: [5, -2] };
  function mouthSVG(view, m, open) {
    const cx = view === 'front' ? 0 : 52, cy = view === 'front' ? -26 : -18, sx = view === 'front' ? 1 : 0.62;
    const P = (pts) => pts.map(([x, y]) => `${(cx + x * sx).toFixed(1)} ${(cy + y).toFixed(1)}`);
    const L = C.line;
    if ((m === 'smile' || m === 'open') && open < 0.05) {
      const p = P([[-14, -4], [-7, 6], [7, 6], [14, -4]]);
      return `<path d="M ${p[0]} C ${p[1]}, ${p[2]}, ${p[3]}" fill="none" stroke="${L}" stroke-width="4.5" stroke-linecap="round"/>`;
    }
    if (m === 'smirk') { const p = P([[-12, 2], [-2, 4], [8, 2], [16, -8]]); return `<path d="M ${p[0]} C ${p[1]}, ${p[2]}, ${p[3]}" fill="none" stroke="${L}" stroke-width="4.5" stroke-linecap="round"/>`; }
    if (m === 'flat') { const p = P([[-12, 0], [12, 0]]); return `<path d="M ${p[0]} L ${p[1]}" fill="none" stroke="${L}" stroke-width="4.5" stroke-linecap="round"/>`; }
    if (m === 'effort') {
      const p = P([[-17, -6], [17, -6], [15, 7], [-15, 7]]); const q = P([[-15, 0.5], [15, 0.5]]);
      return `<path d="M ${p[0]} L ${p[1]} L ${p[2]} L ${p[3]} Z" fill="${C.teeth}" stroke="${L}" stroke-width="4" stroke-linejoin="round"/><path d="M ${q[0]} L ${q[1]}" stroke="${L}" stroke-width="2.5"/>`;
    }
    if (m === 'O') { const r = 6 + 4 * open; return `<ellipse cx="${cx}" cy="${cy + 2}" rx="${(r * 0.8 * sx + (view === 'front' ? 0 : 1)).toFixed(1)}" ry="${(r + 2).toFixed(1)}" fill="${C.mouth}" stroke="${L}" stroke-width="4"/>`; }
    if (m === 'grin') {
      const p = P([[-18, -6], [-10, 14], [10, 14], [18, -6]]); const q = P([[-16, -4], [16, -4]]);
      return `<path d="M ${p[0]} C ${p[1]}, ${p[2]}, ${p[3]} Z" fill="${C.teeth}" stroke="${L}" stroke-width="4" stroke-linejoin="round"/><path d="M ${q[0]} L ${q[1]}" stroke="${L}" stroke-width="2"/>`;
    }
    const o = Math.max(0.15, open), h = 4 + 16 * o;
    const p = P([[-15, -5], [-11, -5 + h * 1.3], [11, -5 + h * 1.3], [15, -5]]);
    const tg = P([[-8, -5 + h * 0.9], [0, -5 + h * 1.15], [8, -5 + h * 0.9]]);
    const tt = P([[-12, -5], [12, -5], [11, -1], [-11, -1]]);
    return `<path d="M ${p[0]} C ${p[1]}, ${p[2]}, ${p[3]} Z" fill="${C.mouth}" stroke="${L}" stroke-width="4" stroke-linejoin="round"/>` +
      (o > 0.35 ? `<path d="M ${tg[0]} Q ${tg[1]} ${tg[2]}" fill="${C.tongue}"/>` : '') +
      `<path d="M ${tt[0]} L ${tt[1]} L ${tt[2]} L ${tt[3]} Z" fill="${C.teeth}"/>`;
  }

  // ================================================================ ACCESORIOS DE ESCENA
  const box = (x, y, w, h, f, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 0}" fill="${f}" stroke="${C.line}" stroke-width="${LW - 1}" stroke-linejoin="round"/>`;
  const PROPS = {
    // banco plano. x,y = centro de la superficie del cojín; h = altura del cojín al suelo (por defecto 92)
    bench: (x, y, w, h) => {
      w = w || 380; h = h || 92; const legH = h - 24;
      return `<g transform="translate(${x} ${y})">
        ${box(-w / 2 + 34, 20, 18, legH, C.metalDark)}${box(w / 2 - 52, 20, 18, legH, C.metalDark)}
        ${box(-w / 2 + 14, h - 12, 58, 12, C.metalDark, 4)}${box(w / 2 - 72, h - 12, 58, 12, C.metalDark, 4)}
        ${box(-w / 2, 0, w, 28, C.bench, 12)}
        <rect x="${-w / 2 + 8}" y="3" width="${w - 16}" height="9" rx="4.5" fill="${C.benchPad}"/>
      </g>`;
    },
    // extremo de la barra visto de lado (disco)
    barbellSide: () => `<g data-prop="barbell">
        <circle r="80" fill="${C.plate}" stroke="${C.line}" stroke-width="${LW}"/>
        <circle r="58" fill="none" stroke="${C.plateRing}" stroke-width="9"/>
        <circle r="17" fill="${C.metal}" stroke="${C.line}" stroke-width="4"/>
        <circle r="6" fill="${C.metalDark}"/></g>`,
    // escalera: n escalones de alto h y huella d desde (x0, y0) subiendo hacia la derecha
    stairs: (x0, y0, n, h, d, col) => {
      col = col || '#2C2A35'; let s = '<g>';
      for (let i = 0; i < n; i++) {
        const x = x0 + i * d, y = y0 - (i + 1) * h, w = d * (n - i) + 600;
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h + 2}" fill="${col}" stroke="${C.line}" stroke-width="${LW - 1}"/>`;
        s += `<path d="M ${x + 3} ${y + 4} L ${x + w - 3} ${y + 4}" stroke="${C.plateRing}" stroke-width="6"/>`;
      }
      return s + '</g>';
    },
    // escalera que baja hacia la derecha: rellano a la izquierda de x0 a la altura y0 - n·h; suelo en y0
    stairsDown: (x0, y0, n, h, d, col) => {
      col = col || '#2C2A35'; let s = '<g>';
      s += `<rect x="${x0 - 700}" y="${y0 - n * h}" width="700" height="${n * h + 4}" fill="${col}" stroke="${C.line}" stroke-width="${LW - 1}"/>`;
      s += `<path d="M ${x0 - 697} ${y0 - n * h + 4} L ${x0 - 3} ${y0 - n * h + 4}" stroke="${C.plateRing}" stroke-width="6"/>`;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * d, y = y0 - (n - 1 - i) * h;
        s += `<rect x="${x - 4}" y="${y}" width="${d + 4}" height="${(n - 1 - i) * h + 4}" fill="${col}" stroke="${C.line}" stroke-width="${LW - 1}"/>`;
        if (i < n - 1 || true) s += `<path d="M ${x - 1} ${y + 4} L ${x + d - 3} ${y + 4}" stroke="${C.plateRing}" stroke-width="6"/>`;
      }
      return s + '</g>';
    },
    // barra vista de frente entre dos agarres (a y b = [x, y]); discos de canto en los extremos
    barbellFront: (a, b) => {
      const cy = (a[1] + b[1]) / 2, x1 = Math.min(a[0], b[0]) - 120, x2 = Math.max(a[0], b[0]) + 120;
      const plate = (x) => `<rect x="${(x - 16).toFixed(1)}" y="${(cy - 78).toFixed(1)}" width="32" height="156" rx="10" fill="${C.plate}" stroke="${C.line}" stroke-width="${LW - 1}"/><path d="M ${x.toFixed(1)} ${(cy - 64).toFixed(1)} L ${x.toFixed(1)} ${(cy + 64).toFixed(1)}" stroke="${C.plateRing}" stroke-width="7"/>`;
      return `<g data-prop="barbellFront"><rect x="${x1.toFixed(1)}" y="${(cy - 8).toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="16" rx="8" fill="${C.metal}" stroke="${C.line}" stroke-width="4"/>${plate(x1 + 24)}${plate(x2 - 24)}</g>`;
    },
    // barra de dominadas: travesaño a la altura y (agarre), postes hasta el suelo (y = 0); w = media anchura
    pullbar: (y, w) => {
      w = w || 330;
      return `<g data-prop="pullbar"><rect x="${-w - 14}" y="${y - 30}" width="28" height="${-y + 30}" fill="${C.metalDark}" stroke="${C.line}" stroke-width="${LW - 1}"/>
        <rect x="${w - 14}" y="${y - 30}" width="28" height="${-y + 30}" fill="${C.metalDark}" stroke="${C.line}" stroke-width="${LW - 1}"/>
        <rect x="${-w - 20}" y="${y - 9}" width="${2 * w + 40}" height="18" rx="9" fill="${C.metal}" stroke="${C.line}" stroke-width="${LW - 1}"/></g>`;
    },
    sweat: (x, y, s) => `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s || 1})" d="M 0 -16 C 0 -16, -10 -2, -10 4 A 10 10 0 0 0 10 4 C 10 -2, 0 -16, 0 -16 Z" fill="${C.sweat}" stroke="${C.line}" stroke-width="3"/>`
  };

  // ================================================================ INSTANCIA (DOM)
  // Orden de dibujo por capas (de atrás adelante). Una capa con varios nodos es una cadena (dos pasadas, sin costuras).
  const LAYERS = {
    front: [['legL', 'kneeL', 'ankleL'], ['legR', 'kneeR', 'ankleR'], 'shorts', 'torso', 'head', ['armL', 'deltL', 'elbowL', 'wristL'], ['armR', 'deltR', 'elbowR', 'wristR']],
    side: [['legFar', 'kneeFar', 'ankleFar'], ['armFar', 'deltFar', 'elbowFar', 'wristFar'], 'shorts', 'torsoBody', ['legNear', 'kneeNear', 'ankleNear'], 'head', ['armNear', 'deltNear', 'elbowNear', 'wristNear']]
  };
  const isFarNode = (defs, id) => { let c = id; while (c) { if (defs[c].far) return true; c = defs[c].parent; } return false; };
  const layerName = (L) => Array.isArray(L) ? L[0] : L;

  function create(opts) {
    opts = opts || {};
    const view = opts.view === 'front' ? 'front' : 'side';
    const defs = DEFS[view];
    const doc = (typeof document !== 'undefined') ? document : null;
    const part = (id, mode) => {
      const n = defs[id]; const far = isFarNode(defs, id);
      MODE = mode; const html = n.draw ? n.draw(far ? FAR : NEAR) : ''; MODE = 'normal';
      return `<g data-j="${id}"${far ? ' data-far="1"' : ''}>${html}</g>`;
    };
    let markup = '<g data-fx-back></g>';
    for (const L of LAYERS[view]) {
      if (Array.isArray(L)) markup += `<g data-layer="${L[0]}"><g data-pass="outline">${L.map((id) => part(id, 'outline')).join('')}</g><g data-pass="fill">${L.map((id) => part(id, 'fill')).join('')}</g></g>`;
      else markup += `<g data-layer="${L}">${part(L, 'normal')}</g>`;
    }
    markup += '<g data-fx-front></g>';
    const nodes = {};
    let g = null, svg = null;
    if (doc) {
      g = doc.createElementNS(NS, 'g');
      g.setAttribute('class', 'repe-toni');
      g.innerHTML = markup;
      g.querySelectorAll('[data-j]').forEach((el) => { const k = el.getAttribute('data-j'); (nodes[k] = nodes[k] || []).push(el); });
      if (opts.standalone !== false) {
        svg = doc.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', opts.viewBox || '-340 -720 680 780');
        svg.setAttribute('width', opts.width || 340);
        svg.setAttribute('height', opts.height || 390);
        svg.appendChild(g);
      }
    }
    const inst = {
      view, g, svg, nodes, markup,
      pose: basePose(view),
      set(partial) { this.pose = merge(basePose(view), partial || {}); this.pose.view = view; render(this); return this; },
      world(id, pt) { return worldPoint(view, this.pose, id, pt); }
    };
    render(inst);
    return inst;
  }

  const clamp01v = (k) => Math.max(0, Math.min(1, k));
  function toggle(els, attr, value) {
    for (const el of els || []) el.querySelectorAll(`[${attr}]`).forEach((h) => {
      if (h.closest('[data-j]') !== el) return;          // solo las piezas de este nodo
      h.style.display = h.getAttribute(attr) === value ? '' : 'none';
    });
  }

  function render(inst) {
    if (!inst.g) return;
    const p = inst.pose, v = inst.view, defs = DEFS[v];
    for (const id of Object.keys(inst.nodes)) {
      const m = worldMatrix(defs, p, id).map((x) => +x.toFixed(4)).join(' ');
      for (const el of inst.nodes[id]) el.setAttribute('transform', `matrix(${m})`);
    }
    // orden de capas opcional por pose (p.zorder = ['torsoBody', 'legNear', ...])
    if (p.zorder && inst._z !== p.zorder.join()) {
      const fxF = inst.g.querySelector('[data-fx-front]');
      for (const name of p.zorder) { const el = inst.g.querySelector(`[data-layer="${name}"]`); if (el) inst.g.insertBefore(el, fxF); }
      inst._z = p.zorder.join();
    }
    const limbs = v === 'front' ? [['armL', 'wristL'], ['armR', 'wristR']] : [['armFar', 'wristFar'], ['armNear', 'wristNear']];
    for (const [arm, wrist] of limbs) {
      const L = p[arm] || {};
      toggle(inst.nodes[wrist], 'data-hand', L.hand || 'fist');
      toggle(inst.nodes[wrist], 'data-prop', L.prop || '__none__');
      if (v === 'front') {
        const auto = clamp01v(((L.el || 0) - 35) / 50) * clamp01v(((L.sh || 0) - 35) / 35);
        const fl = L.flex == null ? auto : (L.flex === true ? 1 : L.flex === false ? 0 : clamp01v(+L.flex));
        const key = fl.toFixed(3);
        for (const el of inst.nodes[arm] || []) {
          if (el._fl === key) continue; el._fl = key;
          el.querySelectorAll('[data-armpath]').forEach((path) => { const k = path.getAttribute('data-armpath'); path.setAttribute('d', lerpPath(ARM_F.normal[k], ARM_F.flex[k], fl)); });
          el.querySelectorAll('[data-armpeak]').forEach((path) => path.setAttribute('opacity', fl.toFixed(2)));
        }
      }
    }
    const H = p.hl || {};
    inst.g.querySelectorAll('[data-hl]').forEach((el) => {
      let val = H[el.getAttribute('data-hl')] || 0;
      if (val && el.closest('[data-far]')) val *= 0.6;
      el.setAttribute('opacity', Math.max(0, Math.min(1, val)).toFixed(3));
    });
    // cara
    const head = inst.nodes.head && inst.nodes.head[0]; if (!head) return;
    const f = p.face || {}, brow = BROWS[f.brows] || BROWS.neutral, by = f.browY || 0, look = f.look || [0, 0];
    const eyes = v === 'front' ? [['L', -17, -50, 9], ['R', 17, -50, 9]] : [['R', 36, -50, 8]];
    for (const [k, ex, ey, rx] of eyes) {
      const pup = head.querySelector(`[data-eye="${k}"] [data-pupil]`);
      if (pup) { pup.setAttribute('cx', (look[0] * 3.5).toFixed(2)); pup.setAttribute('cy', (look[1] * 4.5).toFixed(2)); }
      let blink = Math.max(0, Math.min(1, Math.max(f.blink || 0, f.lid == null ? 0.18 : f.lid)));
      if (f.wink && k === 'R') blink = 1;
      const ry = 11, lid = head.querySelector(`[data-lid="${k}"]`), lline = head.querySelector(`[data-lidline="${k}"]`);
      if (lid) {
        const erx = rx - 0.5;
        if (blink <= 0.02) { lid.setAttribute('d', ''); if (lline) lline.setAttribute('d', ''); }
        else if (blink >= 0.96) {
          lid.setAttribute('d', `M ${ex - erx - 1.5} ${ey} A ${erx + 1.5} ${ry + 1.5} 0 1 1 ${ex + erx + 1.5} ${ey} A ${erx + 1.5} ${ry + 1.5} 0 1 1 ${ex - erx - 1.5} ${ey} Z`);
          lid.setAttribute('stroke', 'none');
          if (lline) lline.setAttribute('d', `M ${ex - erx - 1} ${ey + 1} Q ${ex} ${ey + 7} ${ex + erx + 1} ${ey + 1}`);
        } else {
          const yb = ey - ry + 2 * ry * blink, dy = (yb - ey) / ry, xh = erx * Math.sqrt(Math.max(0, 1 - dy * dy));
          lid.setAttribute('d', `M ${(ex - xh).toFixed(2)} ${yb.toFixed(2)} A ${erx} ${ry} 0 ${yb > ey ? 1 : 0} 1 ${(ex + xh).toFixed(2)} ${yb.toFixed(2)} Q ${ex} ${(yb + 3).toFixed(2)} ${(ex - xh).toFixed(2)} ${yb.toFixed(2)} Z`);
          lid.setAttribute('stroke', C.line);
          if (lline) lline.setAttribute('d', '');
        }
      }
      const bEl = head.querySelector(`[data-brow="${k}"]`);
      if (bEl) {
        const inX = v === 'front' ? (k === 'L' ? -6 : 6) : 46, outX = v === 'front' ? (k === 'L' ? -30 : 30) : 24;
        const baseY = ey - 19 + by, yIn = baseY + brow[0], yOut = baseY + brow[1];
        bEl.setAttribute('d', `M ${outX} ${yOut} Q ${(inX + outX) / 2} ${Math.min(yIn, yOut) - 5} ${inX} ${yIn}`);
      }
    }
    const mouth = head.querySelector('[data-mouth]');
    if (mouth) mouth.innerHTML = mouthSVG(v, f.mouth || 'smile', f.open || 0);
    // efectos (coordenadas del padre de g)
    const fxb = inst.g.querySelector('[data-fx-back]');
    if (fxb) fxb.innerHTML = (p.pullbar && v === 'front') ? PROPS.pullbar(p.pullbar.y, p.pullbar.w) : '';
    const fx = inst.g.querySelector('[data-fx-front]');
    if (fx) {
      let html = '';
      if (p.barFront && v === 'front') html += PROPS.barbellFront(worldPoint(v, p, 'wristL', [0, 30]), worldPoint(v, p, 'wristR', [0, 30]));
      if (p.bar && v === 'side') {
        const a = worldPoint(v, p, 'wristNear', [0, 26]), b = worldPoint(v, p, 'wristFar', [0, 26]);
        html += `<g transform="translate(${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)})">${PROPS.barbellSide()}</g>`;
      }
      if ((p.sweat || 0) > 0.01) {
        const hp = worldPoint(v, p, 'head', v === 'front' ? [56, -92] : [-36, -96]);
        const drop = ((p.sweatT || 0) % 1 + 1) % 1;
        html += `<g opacity="${(Math.min(1, p.sweat) * (1 - drop * 0.6)).toFixed(2)}">${PROPS.sweat(hp[0], hp[1] + 50 * drop, 1.1)}</g>`;
      }
      fx.innerHTML = html;
    }
  }

  // ================================================================ BIBLIOTECA DE ACCIONES
  // Cada acción: (t, o) -> pose. Las de perfil ya vienen apoyadas en el suelo (o.ground, por defecto 0).
  const TAU = Math.PI * 2;
  const sn = (t, f, ph) => Math.sin(TAU * (f * t + (ph || 0)));
  const blinkAt = (t) => { const c = ((t % 3.7) + 3.7) % 3.7; return c < 0.14 ? Math.sin(Math.PI * c / 0.14) : 0; };
  const talkOpen = (t) => Math.max(0, 0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 6.3 + 1));
  const clamp01 = (k) => Math.max(0, Math.min(1, k));
  const faceOf = (t, o, extra) => {
    const f = Object.assign({ mouth: o.talk ? 'open' : 'smile', open: o.talk ? talkOpen(t) : 0, blink: blinkAt(t + (o.seed || 0)), brows: 'neutral' }, extra || {});
    if (o.open != null) { f.mouth = 'open'; f.open = o.open; }        // boca sincronizada con la voz (0–1)
    return f;
  };
  const A = {};

  // ----- DE FRENTE
  A.idle = (t, o) => { o = o || {};
    const b = 0.5 + 0.5 * sn(t, 0.35);
    return { view: 'front', x: o.x || 0, y: o.y || 0, breath: b, torso: 0.6 * sn(t, 0.35), head: 1.5 * sn(t, 0.22),
      armL: { sh: 13 + 2 * b, el: 10 + 3 * b }, armR: { sh: 13 + 2 * b, el: 10 + 3 * b },
      face: faceOf(t, o, { brows: o.brows || 'neutral' }) };
  };
  A.talk = (t, o) => A.idle(t, Object.assign({ talk: true }, o));
  A.wave = (t, o) => { o = o || {};
    const k = clamp01(t * 4), w = sn(t, 1.6);
    return merge(A.idle(t, o), { armR: { sh: 14 + 118 * ease.out(k), el: 10 + 24 * k + 20 * w * k, hand: k > 0.5 ? 'open' : 'fist', flex: false }, head: 4 * k,
      face: { mouth: o.talk ? 'open' : 'grin', brows: 'up' } });
  };
  // doble bíceps con marcado (o.hold alarga la pose)
  A.flexDouble = (t, o) => { o = o || {};
    const hold = o.hold || 1.5, tIn = 0.35, tOut = tIn + hold;
    const pose = keys('front', [
      [0, A.idle(0)],
      [tIn, { armL: { sh: 92, el: 88 }, armR: { sh: 92, el: 88 }, face: { mouth: 'grin', brows: 'cocky' }, breath: 1, head: -3 }, 'back'],
      [tOut, { armL: { sh: 95, el: 92 }, armR: { sh: 95, el: 92 }, face: { mouth: 'grin', brows: 'cocky' }, breath: 1, head: -3 }],
      [tOut + 0.5, A.idle(0)]
    ], t, o.loop);
    const sq = (t > tIn && t < tOut) ? 1.4 * Math.sin(t * 55) : 0;
    pose.armL.sh += sq; pose.armR.sh += sq; pose.armL.el -= sq; pose.armR.el -= sq;
    pose.x = o.x || 0; pose.y = o.y || 0;
    pose.face.blink = blinkAt(t + 1);
    const on = clamp01((t - tIn + 0.1) * 5) * (t < tOut ? 1 : clamp01(1 - (t - tOut) * 3));
    pose.hl = { biceps: o.mark === false ? 0 : on * (0.75 + 0.25 * Math.sin(t * 12)) };
    return pose;
  };
  // marca un músculo con pulso. o.muscle: chest, abs, biceps, triceps, delts, traps, lats, forearms, quads, calves
  A.mark = (t, o) => { o = o || {};
    const k = o.muscle || 'chest', on = clamp01(t * 3) * (0.82 + 0.18 * Math.sin(t * 10));
    let pose = A.idle(t, o);
    pose.hl = { [k]: on };
    if (k === 'chest') pose = merge(pose, { breath: 1.4, armL: { sh: 26, el: 26 }, armR: { sh: 26, el: 26 }, face: { mouth: o.talk ? 'open' : 'grin', brows: 'cocky' } });
    if (k === 'biceps') pose = merge(pose, { armR: { sh: 92, el: 90 }, face: { mouth: 'grin', brows: 'cocky' } });
    if (k === 'triceps') pose = merge(pose, { armL: { sh: 34, el: 0 }, armR: { sh: 34, el: 0 }, face: { brows: 'focus' } });
    if (k === 'delts' || k === 'traps') pose = merge(pose, { armL: { sh: 44 + 6 * Math.sin(t * 6), el: 34 }, armR: { sh: 44 + 6 * Math.sin(t * 6), el: 34 } });
    if (k === 'lats') pose = merge(pose, { armL: { sh: 50, el: 70, flex: false }, armR: { sh: 50, el: 70, flex: false }, breath: 1.2, face: { mouth: 'grin', brows: 'cocky' } });
    if (k === 'abs') pose = merge(pose, { armL: { sh: 150, el: 70, flex: false }, armR: { sh: 150, el: 70, flex: false }, face: { mouth: 'effort', brows: 'angry' } });
    return pose;
  };
  A.point = (t, o) => { o = o || {}; const k = ease.out(clamp01(t * 4));
    return merge(A.idle(t, o), { armR: { sh: 14 + 62 * k, el: 10 + 4 * k, hand: k > 0.4 ? 'point' : 'fist' }, head: -3 * k, face: { brows: 'up' } }); };
  A.thumbsUp = (t, o) => { o = o || {}; const k = ease.back(clamp01(t * 3));
    return merge(A.idle(t, o), { armR: { sh: 14 + 26 * k, el: 10 + 110 * k, wr: -8, hand: k > 0.4 ? 'thumb' : 'fist', flex: false }, face: { mouth: 'grin', wink: t > 0.4 && t < 0.9 } }); };
  A.shrug = (t, o) => { o = o || {}; const k = ease.out(clamp01(t * 4));
    return merge(A.idle(t, o), { armL: { sh: 14 + 22 * k, el: 10 + 74 * k, hand: 'open' }, armR: { sh: 14 + 22 * k, el: 10 + 74 * k, hand: 'open' }, head: 7 * k, y: (o.y || 0) - 6 * k,
      face: { mouth: 'flat', brows: 'sad' } }); };
  A.celebrate = (t, o) => { o = o || {}; const j = Math.abs(Math.sin(t * Math.PI * 2.2));
    return merge(A.idle(t, o), { y: (o.y || 0) - 60 * j, armL: { sh: 158, el: 18, flex: false }, armR: { sh: 158, el: 18, flex: false },
      legL: { hip: 6 + 10 * j }, legR: { hip: 6 + 10 * j }, face: { mouth: 'open', open: 0.9, brows: 'up' } }); };

  // ----- DE PERFIL
  const legFlat = (hip, kn, extra) => ({ hip, kn, an: kn - hip + (extra || 0) });
  A.standSide = (t, o) => { o = o || {};
    const b = 0.5 + 0.5 * sn(t, 0.35);
    return ground({ view: 'side', x: o.x || 0, breath: b, head: 1.2 * sn(t, 0.22), torso: 1 + b,
      legNear: legFlat(2, 4), legFar: legFlat(-2, 2),
      face: faceOf(t, o) }, o.ground || 0);
  };
  // ----- MARCHA CON PIES APOYADOS (cinemática inversa: los pies no patinan)
  const L1 = 100, L2 = 88, ANK = 38, FOOTC = 19;        // muslo, tibia, tobillo→suela, centro del pie respecto al tobillo
  // ángulos de cadera y rodilla (perfil) para llevar el tobillo a (ax, ay) desde la cadera (hx, hy)
  function legIK(hx, hy, ax, ay) {
    let dx = ax - hx, dy = ay - hy, D = Math.hypot(dx, dy);
    const Dm = L1 + L2 - 0.5; if (D > Dm) { dx *= Dm / D; dy *= Dm / D; D = Dm; }
    const phi = Math.atan2(dx, dy);
    const a1 = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))));
    const aK = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2))));
    const hip = (phi + a1) * 180 / Math.PI, kn = 180 - aK * 180 / Math.PI;
    return { hip, kn, an: kn - hip };
  }
  // Recorre una lista de apoyos. cfg: { start: {near:[x,y], far:[x,y]} (tobillos), moves: [{foot, to:[x,y]}], T, lift, lean, swing }
  function gait(t, cfg, o) {
    const T = cfg.T, moves = cfg.moves;
    const pos = { near: cfg.start.near.slice(), far: cfg.start.far.slice() };
    const i = Math.max(0, Math.floor(t / T)), k = Math.max(0, Math.min(1, t / T - i));
    for (let m = 0; m < Math.min(i, moves.length); m++) pos[moves[m].foot] = moves[m].to.slice();
    let moving = null, kk = 0;
    if (i < moves.length) {
      moving = moves[i].foot; kk = k;
      const a = pos[moving], b = moves[i].to;
      const ex = ease.inOut(kk), ey = ease.out(Math.min(1, kk * 1.25));
      const up = b[1] < a[1];                                      // sube (y menor)
      const lift = (cfg.lift || 26) * Math.sin(Math.PI * kk) + (up ? 0 : 0);
      pos[moving] = [a[0] + (b[0] - a[0]) * ex, (up ? a[1] + (b[1] - a[1]) * ey : a[1] + (b[1] - a[1]) * ex) - lift];
    }
    const n = pos.near, f = pos.far;
    const sep = Math.abs(n[0] - f[0]);
    const lowY = Math.max(n[1], f[1]), highY = Math.min(n[1], f[1]);
    const hx = cfg.hx != null ? cfg.hx : (n[0] + f[0]) / 2 + (cfg.lean || 0) * 0.6;
    const reach = Math.sqrt(Math.max(0, Math.pow(L1 + L2 - 6, 2) - Math.pow(sep / 2, 2)));
    let hy = (cfg.hipFromHigh ? highY - (cfg.hipFromHigh) : (lowY + highY) / 2 - reach * 0.97);
    const legN = legIK(hx + 4, hy, n[0], n[1]), legF = legIK(hx - 4, hy - 2, f[0], f[1]);
    if (moving) { const toe = 10 * Math.sin(Math.PI * kk); (moving === 'near' ? legN : legF).an += toe; }
    const sw = (cfg.swing || 22) * (moving ? Math.sin(Math.PI * kk) : 0) * (moving === 'near' ? 1 : -1);
    return {
      view: 'side', x: hx, y: hy + 214, torso: (cfg.torso || 5), head: (cfg.head || -2),
      legNear: legN, legFar: legF,
      armNear: { sh: -sw, el: 24 + 0.3 * Math.abs(sw) }, armFar: { sh: sw, el: 24 + 0.3 * Math.abs(sw) },
      face: faceOf(t, o || {}, cfg.face || {})
    };
  }
  // andar. o.x0 = x inicial (centro), o.ground = suelo, o.step = separación entre pies (150), o.T = s por paso (0.42)
  // o.steps = nº de pasos (por defecto infinito: sigue andando); o.move:false = andar en el sitio
  A.walk = (t, o) => { o = o || {};
    const S = o.step || 150, T = o.T || 0.42, g = (o.ground || 0) - ANK, x0 = o.x0 || 0;
    if (o.move === false) {
      const ph = (t / T) % 2, i = Math.floor(ph), k = ph - i;
      const base = { near: [x0 + S / 2, g], far: [x0 - S / 2, g] };
      const mv = i === 0 ? [{ foot: 'far', to: [x0 + S / 2, g] }] : [{ foot: 'near', to: [x0 + S / 2, g] }];
      const start = i === 0 ? base : { near: [x0 - S / 2, g], far: [x0 + S / 2, g] };
      const pose = gait(k * T, { T, start, moves: mv, lift: 30, torso: 5 }, o);
      pose.x = x0; return pose;
    }
    const n = o.steps != null ? o.steps : Math.ceil(t / T) + 2;
    const moves = []; let fx = x0 - S / 2, nx = x0 + S / 2;
    for (let m = 0; m < n; m++) {
      if (m % 2 === 0) { fx = nx + S; moves.push({ foot: 'far', to: [fx, g] }); }
      else { nx = fx + S; moves.push({ foot: 'near', to: [nx, g] }); }
    }
    if (o.steps != null) moves.push(n % 2 === 0 ? { foot: 'far', to: [nx, g] } : { foot: 'near', to: [fx, g] });
    const total = o.steps != null ? (o.steps + 0.5) * S : Infinity;
    return gait(t, { T, start: { near: [x0 + S / 2, g], far: [x0 - S / 2, g] }, moves, lift: 30, torso: 5, hx: x0 + Math.min(total, S * t / T) }, o);
  };
  // escalera que sube hacia la derecha: el primer escalón empieza en o.x0, el suelo está en o.y0; o.n escalones de alto o.h y huella o.d
  // (dibújala con RepeToni.props.stairs(o.x0, o.y0, o.n, o.h, o.d))
  A.stairsUp = (t, o) => { o = o || {};
    const h = o.h || 70, d = o.d || 130, n = o.n || 5, x0 = o.x0 || 0, y0 = o.y0 || 0, T = o.T || 0.5;
    const tread = (i) => [x0 + i * d + d / 2 - FOOTC, y0 - (i + 1) * h - ANK];
    const moves = []; for (let i = 0; i < n; i++) moves.push({ foot: i % 2 === 0 ? 'near' : 'far', to: tread(i) });
    moves.push({ foot: n % 2 === 0 ? 'near' : 'far', to: [tread(n - 1)[0] - 30, tread(n - 1)[1]] });
    const pose = gait(t, { T, start: { near: [x0 - 70, y0 - ANK], far: [x0 - 130, y0 - ANK] }, moves, lift: 34, torso: 12, head: -8, swing: 26, face: { brows: 'focus' } }, o);
    return pose;
  };
  // escalera que baja hacia la derecha: rellano arriba a la izquierda de o.x0; el suelo (abajo) en o.y0
  // (dibújala con RepeToni.props.stairsDown(o.x0, o.y0, o.n, o.h, o.d))
  A.stairsDown = (t, o) => { o = o || {};
    const h = o.h || 70, d = o.d || 130, n = o.n || 5, x0 = o.x0 || 0, y0 = o.y0 || 0, T = o.T || 0.5;
    const tread = (i) => [x0 + i * d + d / 2 - FOOTC, y0 - (n - 1 - i) * h - ANK];
    const moves = []; for (let i = 0; i < n; i++) moves.push({ foot: i % 2 === 0 ? 'near' : 'far', to: tread(i) });
    moves.push({ foot: n % 2 === 0 ? 'near' : 'far', to: [x0 + n * d + 40, y0 - ANK] });
    moves.push({ foot: n % 2 === 0 ? 'far' : 'near', to: [x0 + n * d + 100, y0 - ANK] });
    const top = y0 - n * h - ANK;
    return gait(t, { T, start: { near: [x0 - 60, top], far: [x0 - 120, top] }, moves, lift: 18, torso: 2, head: 10, swing: 16, face: { look: [0.5, 0.9] } }, o);
  };
  // curl de bíceps con mancuerna. o.period = segundos por repetición (2)
  A.curl = (t, o) => { o = o || {};
    const per = o.period || 2, k = (((t % per) + per) % per) / per;
    const up = k < 0.4 ? ease.inOut(k / 0.4) : (k < 0.55 ? 1 : 1 - ease.inOut((k - 0.55) / 0.45));
    return ground({ view: 'side', x: o.x || 0, breath: 0.5 + 0.5 * up, torso: 3 - 3 * up,
      legNear: legFlat(4, 6), legFar: legFlat(-4, 4),
      armNear: { sh: 4 + 8 * up, el: 8 + 132 * up, wr: -14 * up, hand: 'fist', prop: 'dumbbell' },
      armFar: { sh: 2, el: 10, hand: 'fist', prop: 'dumbbell' },
      hl: { biceps: o.mark === false ? 0 : 0.35 + 0.65 * up },
      face: faceOf(t, o, { mouth: up > 0.6 ? 'effort' : (o.talk ? 'open' : 'smile'), brows: up > 0.6 ? 'angry' : 'focus' }) }, o.ground || 0);
  };
  // sentadilla. o.period = segundos por repetición (2.4). Los pies no se mueven (tobillo en o.x).
  A.squat = (t, o) => { o = o || {};
    const per = o.period || 2.4, k = (((t % per) + per) % per) / per;
    const dn = k < 0.45 ? ease.inOut(k / 0.45) : (k < 0.55 ? 1 : 1 - ease.inOut((k - 0.55) / 0.45));
    const hip = 100 * dn, kn = 118 * dn;
    const pose = { view: 'side', x: 0, torso: 40 * dn, head: -26 * dn,
      legNear: legFlat(hip, kn), legFar: legFlat(hip - 2, kn - 2),
      armNear: { sh: 86 * dn + 4, el: 8 }, armFar: { sh: 86 * dn + 2, el: 10 },
      hl: { quads: o.mark === false ? 0 : 0.35 + 0.65 * dn, glutes: o.mark === false ? 0 : 0.6 * dn },
      sweat: o.sweat ? 1 : 0, sweatT: t * 0.8,
      face: faceOf(t, o, { mouth: dn > 0.7 ? 'effort' : 'smile', brows: 'focus' }) };
    return ground(pose, o.ground || 0, 'near', o.x || 0);
  };
  // press de banca (tumbado). o.x,o.y = centro de la superficie del banco (usa props.bench con h = 92)
  A.bench = (t, o) => { o = o || {};
    const per = o.period || 2.6, k = (((t % per) + per) % per) / per;
    const dn = k < 0.45 ? ease.inOut(k / 0.45) : (k < 0.52 ? 1 : 1 - ease.inOut((k - 0.52) / 0.48)); // 1 = barra en el pecho
    const pushing = k >= 0.52;
    return { view: 'side', pivot: 'pelvis', x: (o.x || 0) + 112, y: (o.y || 0) - 82, rot: -90,
      torso: 0, head: -14, hips: 0,
      legNear: { hip: -22, kn: 70, an: 2 }, legFar: { hip: -26, kn: 66, an: 2 },
      armNear: { sh: 92 - 82 * dn, el: 4 + 112 * dn, hand: 'fist' },
      armFar: { sh: 92 - 82 * dn, el: 4 + 112 * dn, hand: 'fist' },
      breath: 1 - 0.5 * dn,
      hl: { chest: o.mark === false ? 0 : 0.45 + 0.55 * (pushing ? 1 : dn) },
      face: { mouth: pushing ? 'effort' : 'O', open: 0.3, brows: pushing ? 'angry' : 'focus', look: [0.3, -1], blink: 0 },
      sweat: o.sweat ? 1 : 0, sweatT: t,
      bar: true };
  };

  // ----- IK DE BRAZO DE FRENTE: lleva el agarre (centro del puño) a un punto, con el codo hacia fuera y abajo
  const UA = 122, FA = 134;
  function armIKF(pose, side, tx, ty) {
    let sol = { sh: 90, el: 0 };
    for (let it = 0; it < 3; it++) {
      const full = merge(basePose('front'), merge(pose, { [side === 'L' ? 'armL' : 'armR']: sol }));
      const S0 = worldPoint('front', full, side === 'L' ? 'armL' : 'armR', [0, 0]);
      let vx = tx - S0[0], vy = ty - S0[1], D = Math.hypot(vx, vy);
      const Dm = UA + FA - 0.5; if (D > Dm) { vx *= Dm / D; vy *= Dm / D; D = Dm; }
      const phi = Math.atan2(side === 'L' ? -vx : vx, vy);
      const a1 = Math.acos(Math.max(-1, Math.min(1, (UA * UA + D * D - FA * FA) / (2 * UA * D))));
      const aE = Math.acos(Math.max(-1, Math.min(1, (UA * UA + FA * FA - D * D) / (2 * UA * FA))));
      sol = { sh: (phi - a1) * 180 / Math.PI, el: 180 - aE * 180 / Math.PI };
    }
    return sol;
  }
  const cycle = (t, per, down, hold) => { // 0→1→0: baja en 'down', mantiene 'hold', vuelve
    const k = (((t % per) + per) % per) / per, d = down || 0.45, h = hold || 0.1;
    return k < d ? ease.inOut(k / d) : (k < d + h ? 1 : 1 - ease.inOut((k - d - h) / (1 - d - h)));
  };

  // press militar (de frente) con barra: 1 = barra arriba. o.period (2.4 s)
  A.press = (t, o) => { o = o || {};
    const up = cycle(t, o.period || 2.4, 0.42, 0.12);
    const base = { view: 'front', x: o.x || 0, y: o.y || 0, breath: 0.6 + 0.4 * up, torso: 0, head: -5 * (1 - up),
      legL: { hip: 7 }, legR: { hip: 7 },
      face: faceOf(t, o, { mouth: up > 0.25 && up < 0.85 ? 'effort' : 'smile', brows: up > 0.25 ? 'angry' : 'focus' }) };
    const gy = -452 - 30 - 230 * up, gx = 172 + 14 * up;
    const L = armIKF(base, 'L', (o.x || 0) - gx, (o.y || 0) + gy), R = armIKF(base, 'R', (o.x || 0) + gx, (o.y || 0) + gy);
    return Object.assign(base, { armL: Object.assign(L, { hand: 'fist', flex: 0.25 }), armR: Object.assign(R, { hand: 'fist', flex: 0.25 }), barFront: true,
      hl: { delts: o.mark === false ? 0 : 0.5 + 0.5 * up, triceps: o.mark === false ? 0 : 0.4 * up } });
  };
  // dominadas (de frente) colgado de una barra a la altura o.barY (−760 sobre el suelo). 1 = barbilla por encima
  A.pullup = (t, o) => { o = o || {};
    const up = cycle(t, o.period || 2.6, 0.45, 0.12), barY = o.barY || -760;
    const ry = barY + 250 + 454 - 150 * up;            // altura de los pies (cuelga)
    const base = { view: 'front', x: o.x || 0, y: ry, breath: 0.5 + 0.5 * up, torso: 0, head: -4 * up,
      legL: { hip: 3, kn: 0 }, legR: { hip: 3, kn: 0 }, pullbar: { y: barY, w: o.barW || 330 },
      face: faceOf(t, o, { mouth: up > 0.3 ? 'effort' : 'smile', brows: up > 0.3 ? 'angry' : 'focus', look: [0, -0.6] }) };
    const gx = 196;
    const L = armIKF(base, 'L', (o.x || 0) - gx, barY), R = armIKF(base, 'R', (o.x || 0) + gx, barY);
    return Object.assign(base, { armL: Object.assign(L, { hand: 'fist' }), armR: Object.assign(R, { hand: 'fist' }),
      hl: { lats: o.mark === false ? 0 : 0.5 + 0.5 * up, biceps: o.mark === false ? 0 : 0.3 + 0.5 * up } });
  };
  // peso muerto (perfil) con barra. Los pies no se mueven (tobillo en o.x). 1 = barra en el suelo
  A.deadlift = (t, o) => { o = o || {};
    const dn = cycle(t, o.period || 3, 0.45, 0.1);
    // tabla resuelta para que la barra baje en vertical sobre el medio pie (brazos cortos → rodillas flexionadas)
    const TBL = [[0, -3, 0, 3], [3, 8.4, 36, 49], [5, 16.4, 50, 58], [7, 22.9, 60, 60], [8, 28.4, 68, 68], [9, 31, 78, 78]];
    const fi = Math.min(4.999, dn * 5), i0 = Math.floor(fi), fr = fi - i0;
    const [P, tor, thigh, kn] = TBL[i0].map((v, j) => v + (TBL[i0 + 1][j] - v) * fr);
    const hip = P + thigh;
    const pose = { view: 'side', x: 0, hips: P, torso: tor, head: -20 * dn,
      legNear: { hip, kn }, legFar: { hip: hip - 2, kn: kn - 2 },
      armNear: { sh: P + tor + 2, el: 4, hand: 'fist' }, armFar: { sh: P + tor + 2, el: 4, hand: 'fist' },
      bar: true, breath: 0.4 + 0.6 * (1 - dn),
      hl: { hams: o.mark === false ? 0 : 0.5 + 0.5 * dn, glutes: o.mark === false ? 0 : 0.5 + 0.5 * dn, back: o.mark === false ? 0 : 0.3 + 0.5 * dn },
      face: faceOf(t, o, { mouth: dn > 0.6 ? 'effort' : 'smile', brows: 'focus' }) };
    // el tobillo compensa el giro de la pelvis para que el pie quede plano
    pose.legNear.an = P - hip + kn; pose.legFar.an = P - (hip - 2) + (kn - 2);
    return ground(pose, o.ground || 0, 'near', o.x || 0);
  };
  // zancada (perfil): pie delantero en o.x + 130, trasero en o.x − 150. 1 = rodilla de atrás casi en el suelo
  A.lunge = (t, o) => { o = o || {};
    const dn = cycle(t, o.period || 2.4, 0.45, 0.1), x0 = o.x || 0, g = (o.ground || 0) - ANK;
    const fa = [x0 + 130, g], ba = [x0 - 150, g - 22];
    const hx = x0 - 8, hy = g - 150 + 62 * dn;
    const front = legIK(hx + 4, hy, fa[0], fa[1]), back = legIK(hx - 4, hy - 2, ba[0], ba[1]);
    back.an -= 38;
    return { view: 'side', x: hx, y: hy + 214, torso: 4, head: -3,
      legNear: front, legFar: back,
      armNear: { sh: -8, el: 20 }, armFar: { sh: 8, el: 20 },
      hl: { quads: o.mark === false ? 0 : 0.4 + 0.6 * dn, glutes: o.mark === false ? 0 : 0.6 * dn },
      face: faceOf(t, o, { mouth: dn > 0.7 ? 'effort' : 'smile', brows: 'focus' }) };
  };

  // Pose lista para usar desde un guion: acción + opciones comunes.
  //   o.mark: 'chest' | ['chest','abs'] → marca músculos (pulso); o.face: {…} → sobrescribe la cara;
  //   o.flip: true → mira a la izquierda; o.scale; o.dx/o.dy → desplaza.
  function pose(name, t, o) {
    o = o || {};
    const fn = A[name]; if (!fn) throw new Error('Acción desconocida: ' + name);
    let p = fn(t, o);
    if (o.mark) {
      const list = Array.isArray(o.mark) ? o.mark : [o.mark];
      const on = Math.max(0, Math.min(1, t * 3)) * (0.82 + 0.18 * Math.sin(t * 10));
      const hlx = Object.assign({}, p.hl || {}); list.forEach((m) => { hlx[m] = Math.max(hlx[m] || 0, on); }); p = Object.assign({}, p, { hl: hlx });
    }
    if (o.face) p = merge(p, { face: o.face });
    if (o.flip) p = Object.assign({}, p, { flip: true });
    if (o.scale) p = Object.assign({}, p, { scale: o.scale });
    if (o.dx || o.dy) p = Object.assign({}, p, { x: (p.x || 0) + (o.dx || 0), y: (p.y || 0) + (o.dy || 0) });
    return p;
  }
  // vista que usa cada acción (para crear la instancia correcta)
  const VIEW_OF = { idle: 'front', talk: 'front', wave: 'front', flexDouble: 'front', mark: 'front', point: 'front', thumbsUp: 'front', shrug: 'front', celebrate: 'front',
    press: 'front', pullup: 'front',
    standSide: 'side', walk: 'side', stairsUp: 'side', stairsDown: 'side', curl: 'side', squat: 'side', bench: 'side', deadlift: 'side', lunge: 'side' };

  function play(inst, name, t, o) {
    const fn = A[name]; if (!fn) throw new Error('Acción desconocida: ' + name);
    const pose = fn(t, o || {}); inst.set(pose); return pose;
  }

  const api = { version: '1.1.0', armIKF, cycle, create, actions: A, pose, viewOf: (name) => VIEW_OF[name] || 'front', keys, blend, merge, lerpPose, ease, ground, worldPoint, basePose, play, gait, legIK, colors: C, props: PROPS, symbolPaths };
  root.RepeToni = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
