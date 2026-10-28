// Small deterministic helpers for the hand-drawn SpendMemory artwork.

export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

/** Outline of a spur gear centred on (0, 0). */
export function gearOutline(radius: number, teeth: number, depth = 11) {
  const step = (Math.PI * 2) / teeth;
  const tip = radius + depth / 2;
  const root = radius - depth / 2;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [root, a],
      [tip, a + step * 0.2],
      [tip, a + step * 0.48],
      [root, a + step * 0.68],
    ];
    pts.forEach(([r, ang], j) => {
      d += `${i === 0 && j === 0 ? 'M' : 'L'}${f(Math.cos(ang) * r)} ${f(Math.sin(ang) * r)}`;
    });
  }
  return d + 'Z';
}

/** A circle drawn as a slightly wobbly, overshooting pencil stroke. */
export function sketchCircle(r: number, rnd: () => number, wobble = 1.6) {
  const n = 28;
  const start = rnd() * Math.PI * 2;
  const sweep = Math.PI * 2 * (1.04 + rnd() * 0.05);
  const ox = (rnd() - 0.5) * wobble * 2;
  const oy = (rnd() - 0.5) * wobble * 2;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = start + (sweep * i) / n;
    const rr = r + (rnd() - 0.5) * wobble;
    d += `${i ? 'L' : 'M'}${f(ox + Math.cos(a) * rr)} ${f(oy + Math.sin(a) * rr)}`;
  }
  return d;
}

/** Window cut-outs between spokes, as annular sectors. */
export function spokeWindows(inner: number, outer: number, count: number, gap = 0.32) {
  const step = (Math.PI * 2) / count;
  let d = '';
  for (let i = 0; i < count; i++) {
    const a0 = i * step + gap / 2;
    const a1 = (i + 1) * step - gap / 2;
    const p = (r: number, a: number) => `${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
    d += `M${p(outer, a0)}A${outer} ${outer} 0 0 1 ${p(outer, a1)}L${p(inner, a1)}A${inner} ${inner} 0 0 0 ${p(inner, a0)}Z`;
  }
  return d;
}

/** Illegible notebook script: loops and strokes that read as handwriting from afar. */
export function scribbleLine(width: number, rnd: () => number, height = 7) {
  let x = 0;
  let d = `M0 ${f(height * 0.6)}`;
  while (x < width) {
    const word = 3 + Math.floor(rnd() * 6);
    for (let i = 0; i < word && x < width; i++) {
      const w = 3 + rnd() * 4;
      const h = height * (0.45 + rnd() * 0.75);
      const up = rnd() < 0.18 ? height * 0.9 : 0;
      d += `Q${f(x + w * 0.2)} ${f(height - h - up)} ${f(x + w * 0.55)} ${f(height * 0.3)}`;
      d += `Q${f(x + w * 0.85)} ${f(height * (0.9 + rnd() * 0.2))} ${f(x + w)} ${f(height * 0.55)}`;
      x += w;
    }
    x += 5 + rnd() * 6;
    d += `M${f(x)} ${f(height * 0.6)}`;
  }
  return d;
}

/** A hanging wire between two points, sagging like a loose thread. */
export function wirePath(x0: number, y0: number, x1: number, y1: number, slack = 1) {
  const dx = x1 - x0;
  const c1x = x0 + dx * 0.12 - 30 * slack;
  const c1y = y0 - 150 * slack;
  const c2x = x1 - dx * 0.08;
  const c2y = y1 + 170 * slack;
  return `M${f(x0)} ${f(y0)}C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x1)} ${f(y1)}`;
}
