import { useMemo, useState, type CSSProperties } from 'react';
import { gearOutline, scribbleLine, seeded, sketchCircle, spokeWindows, wirePath } from './geometry';
import './art.css';

/*
 * The SpendMemory artwork. Three references merged into one sheet:
 * an inventor's notebook (sepia gears, ledger boxes and annotations on parchment),
 * a row of stippled heads turning (one reviewer, review after review), and a head
 * wired to pinned clippings (each past decision is a page the next review can read).
 */

type Gear = { cx: number; cy: number; r: number; teeth: number; spokes: number; dur: number; dir: 1 | -1; seed: number };
type Clip = { k: string; x: number; y: number; w: number; h: number; rot: number; title: string; color: string; kind: 'face' | 'ledger' | 'blob' | 'faces'; img?: string };

const GEARS: Gear[] = [
  { cx: 262, cy: 424, r: 182, teeth: 40, spokes: 6, dur: 140, dir: 1, seed: 11 },
  { cx: 448, cy: 202, r: 108, teeth: 24, spokes: 5, dur: 84, dir: -1, seed: 23 },
  { cx: 172, cy: 668, r: 76, teeth: 17, spokes: 4, dur: 60, dir: -1, seed: 37 },
  { cx: 610, cy: 172, r: 54, teeth: 12, spokes: 0, dur: 42, dir: 1, seed: 41 },
];

const HEADS = [
  { src: 'head-1', x: 300, y: 438, s: 296 },
  { src: 'head-2', x: 500, y: 410, s: 318 },
  { src: 'head-3', x: 712, y: 392, s: 332 },
  { src: 'head-4', x: 934, y: 386, s: 346 },
  { src: 'head-5', x: 1168, y: 376, s: 382 },
];

// Scalp points on the last head, as fractions of its image box (traced from its stipple contour).
const ELECTRODES: [number, number][] = [[0.585, 0.15], [0.632, 0.163], [0.676, 0.196], [0.72, 0.243], [0.76, 0.305], [0.618, 0.228], [0.702, 0.29]];

const CLIPS: Clip[] = [
  { k: 'decline', x: 784, y: 52, w: 170, h: 218, rot: -4, title: 'DEMOCLOUD DECLINED', color: '#c3392b', kind: 'face', img: 'head-2' },
  { k: 'balance', x: 974, y: 22, w: 192, h: 252, rot: 2.5, title: 'BALANCE CHECKED', color: '#d89b2c', kind: 'ledger' },
  { k: 'blob', x: 1190, y: 58, w: 172, h: 204, rot: -2, title: 'CONFIRMED BLOB', color: '#6f8a86', kind: 'blob' },
  { k: 'recall', x: 1386, y: 30, w: 180, h: 236, rot: 3.5, title: 'RECALLED AFTER RESTART', color: '#1c58c9', kind: 'faces', img: 'head-4' },
];

const LOOSE = [
  { e: 4, to: [1600, 214] as const, color: '#b9b2a2' },
  { e: 5, to: [1600, 352] as const, color: '#c3392b' },
  { e: 6, to: [1600, 452] as const, color: '#8d9a8f' },
];

const vars = (o: Record<string, string | number>) => o as CSSProperties;
const rad = (d: number) => (d * Math.PI) / 180;
function pinPoint(c: Clip) {
  const lx = c.w / 2;
  const ly = c.h - 8;
  const a = rad(c.rot);
  return [c.x + Math.cos(a) * lx - Math.sin(a) * ly, c.y + Math.sin(a) * lx + Math.cos(a) * ly] as const;
}

const head5 = HEADS[4];
const electrode = (i: number) => [head5.x + ELECTRODES[i][0] * head5.s, head5.y + ELECTRODES[i][1] * head5.s] as const;

export function MemoryArtwork({ className = '', base = '/art' }: { className?: string; base?: string }) {
  const [lit, setLit] = useState<string | null>(null);

  const drawn = useMemo(() => {
    const gears = GEARS.map((g) => {
      const rnd = seeded(g.seed);
      return {
        ...g,
        outline: gearOutline(g.r, g.teeth, g.r > 100 ? 13 : 10),
        rims: [g.r - 18, g.r - 26, g.r * 0.36, g.r * 0.22, g.r * 0.12].map((r) => sketchCircle(r, rnd)),
        windows: g.spokes ? spokeWindows(g.r * 0.42, g.r - 32, g.spokes) : '',
      };
    });
    const rnd = seeded(5);
    const ledger = Array.from({ length: 7 }, () => scribbleLine(120 + rnd() * 30, rnd));
    const ledgerKeys = Array.from({ length: 7 }, () => scribbleLine(26, rnd));
    const clipText = CLIPS.map(() => Array.from({ length: 9 }, () => 0.55 + rnd() * 0.45));
    return { gears, ledger, ledgerKeys, clipText };
  }, []);

  return <svg className={`memory-art ${className}`} viewBox="0 0 1600 830" preserveAspectRatio="xMaxYMid slice" role="img" aria-labelledby="memory-art-title memory-art-desc">
    <title id="memory-art-title">One reviewer, wired to past decisions</title>
    <desc id="memory-art-desc">A sketchbook drawing: ink gears for the review rules, a row of stippled heads turning from one review to the next, and the last head wired to pinned clippings of a declined DemoCloud payment, a balance check, a confirmed Walrus blob and a recall after restart.</desc>
    <defs>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2"/>
      </filter>
      <filter id="paper-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="5" stdDeviation="5" floodColor="#3a2a1a" floodOpacity="0.22"/>
      </filter>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="#5a4330" strokeWidth="1.1" opacity=".55"/>
      </pattern>
      <radialGradient id="stain" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#9c7a4b" stopOpacity=".2"/>
        <stop offset=".7" stopColor="#9c7a4b" stopOpacity=".08"/>
        <stop offset="1" stopColor="#9c7a4b" stopOpacity="0"/>
      </radialGradient>
      {CLIPS.map((c) => <clipPath id={`clip-img-${c.k}`} key={c.k}><rect x="10" y="58" width={c.w - 20} height={c.kind === 'faces' ? 92 : 78}/></clipPath>)}
    </defs>

    <g className="art-paper" aria-hidden="true">
      <ellipse cx="420" cy="540" rx="330" ry="210" fill="url(#stain)"/>
      <ellipse cx="1330" cy="720" rx="260" ry="120" fill="url(#stain)"/>
      <ellipse cx="1040" cy="150" rx="220" ry="140" fill="url(#stain)" opacity=".7"/>
    </g>

    <g className="art-gears" aria-hidden="true">
      {drawn.gears.map((g, i) => {
        const spin = vars({ '--dur': `${g.dur}s` });
        const cls = g.dir < 0 ? 'gear rev' : 'gear';
        return <g key={i}>
          <g transform={`translate(${g.cx + 9} ${g.cy + 13})`}>
            <g className={cls} style={spin}><path d={g.outline} fill="url(#hatch)" className="ink-faint"/></g>
          </g>
          <g transform={`translate(${g.cx} ${g.cy})`}>
            <g className={cls} style={spin}>
              <path d={g.outline} className="ink-fill"/>
              {g.rims.map((d, j) => <path key={j} d={d} className={j < 2 ? 'ink' : 'ink thin'}/>)}
              {g.windows && <path d={g.windows} fill="url(#hatch)" className="ink thin"/>}
            </g>
          </g>
        </g>;
      })}
    </g>

    <g className="art-sketch" filter="url(#ink)" aria-hidden="true">
      <path d="M0 424H720" className="construct"/>
      <path d="M262 160V720" className="construct"/>
      <circle cx="262" cy="424" r="240" className="construct dashed"/>
      <g transform="translate(34 40)" className="ledger">
        <rect width="236" height="168" className="ink thin" fill="none"/>
        <path d="M44 0V168M0 28H236" className="ink thin"/>
        {drawn.ledger.map((d, i) => <g key={i}>
          <path d={drawn.ledgerKeys[i]} transform={`translate(8 ${36 + i * 18})`} className="script"/>
          <path d={d} transform={`translate(54 ${36 + i * 18})`} className="script"/>
        </g>)}
        <path d={drawn.ledger[0]} transform="translate(54 9) scale(.9)" className="script strong"/>
      </g>
      <path d="M560 790H1520M560 780V800M1520 780V800" className="ink thin"/>
      <path d="M318 748Q306 690 292 622" className="ink thin"/>
    </g>

    <g className="art-notes" aria-hidden="true">
      <text x="236" y="786" className="hand">policy and recall</text>
      <text x="880" y="816" className="hand">one reviewer, five reviews apart</text>
      <text x="1010" y="352" className="hand" transform="rotate(-4 1010 352)">every decision pinned to Walrus</text>
    </g>

    <g className="art-heads" aria-hidden="true">
      {HEADS.map((h, i) => <image key={h.src} href={`${base}/${h.src}.webp`} x={h.x} y={h.y} width={h.s} height={h.s} className="head" style={vars({ '--i': i })}/>)}
    </g>

    <g className="art-clips">
      {CLIPS.map((c, i) => <g key={c.k} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`}>
        <g className="clip-drop" style={vars({ '--i': i })}><g className={`clip ${lit === c.k ? 'lift' : ''}`} onPointerEnter={() => setLit(c.k)} onPointerLeave={() => setLit(null)}>
          <rect width={c.w} height={c.h} className="clip-paper" filter="url(#paper-shadow)"/>
          <rect x="10" y="10" width={c.w - 20} height="40" fill="#1c58c9"/>
          <text x="17" y="39" className="clip-title" textLength={c.w - 34} lengthAdjust="spacingAndGlyphs">{c.title}</text>
          {c.kind === 'face' && c.img && <g clipPath={`url(#clip-img-${c.k})`}><rect x="10" y="58" width={c.w - 20} height="78" fill="#efe9dc"/><image href={`${base}/${c.img}.webp`} x="-78" y="-44" width={c.w * 1.7} height={c.w * 1.7}/></g>}
          {c.kind === 'faces' && c.img && <g clipPath={`url(#clip-img-${c.k})`}><rect x="10" y="58" width={c.w - 20} height="92" fill="#e9e3d5"/><image href={`${base}/head-3.webp`} x="2" y="44" width="96" height="96"/><image href={`${base}/${c.img}.webp`} x="76" y="44" width="96" height="96"/></g>}
          {c.kind === 'ledger' && <g transform="translate(10 58)">
            <rect width={c.w - 20} height="78" fill="#f1ecdf"/>
            {[0, 1, 2, 3].map((r) => <g key={r}><path d={`M6 ${18 + r * 18}H${c.w - 26}`} className="clip-rule"/><text x="8" y={14 + r * 18} className="clip-num">{['5.270', '0.020', 'ok', 'sui'][r]}</text></g>)}
          </g>}
          {c.kind === 'blob' && <g transform="translate(10 58)">
            <rect width={c.w - 20} height="78" fill="#20180f"/>
            <text x="9" y="22" className="clip-mono">VpDjzjIwtRW1</text>
            <text x="9" y="42" className="clip-mono">UQJ8LOrUjUp2</text>
            <text x="9" y="62" className="clip-mono">rbfV-RaIU36…</text>
          </g>}
          {drawn.clipText[i].slice(0, c.kind === 'faces' ? 6 : 7).map((wv, j) => <rect key={j} x="12" y={(c.kind === 'faces' ? 160 : 146) + j * 9} width={(c.w - 24) * wv} height="3.4" className="clip-line"/>)}
          <rect x={c.w / 2 - 24} y="-8" width="48" height="17" className="clip-tape" transform={`rotate(${i % 2 ? 6 : -5} ${c.w / 2} 0)`}/>
          <circle cx={c.w / 2} cy={c.h - 8} r="4.2" className="clip-pin"/>
        </g></g>
      </g>)}
    </g>

    <g className="art-wires" aria-hidden="true">
      {LOOSE.map((l, i) => {
        const [x0, y0] = electrode(l.e);
        return <path key={`l${i}`} d={wirePath(x0, y0, l.to[0], l.to[1], 0.55)} stroke={l.color} className="wire loose" pathLength={1} style={vars({ '--i': i + 4 })}/>;
      })}
      {CLIPS.map((c, i) => {
        const [x0, y0] = electrode(i);
        const [x1, y1] = pinPoint(c);
        return <path key={c.k} d={wirePath(x0, y0, x1, y1)} stroke={c.color} className={`wire ${lit === c.k ? 'lit' : ''}`} pathLength={1} style={vars({ '--i': i })}/>;
      })}
      {ELECTRODES.map((_, i) => {
        const [x, y] = electrode(i);
        return <g key={i} transform={`rotate(${(i * 37) % 50 - 25} ${x} ${y})`}><rect x={x - 9} y={y - 6} width="18" height="12" rx="1.5" className="tape" style={vars({ '--i': i })}/></g>;
      })}
    </g>
  </svg>;
}
