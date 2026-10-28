import { useMemo } from 'react';
import { seeded } from './geometry';

/** The SpendMemory mark: a stippled disc, lit from the upper left like the heads. */
export function StippleMark({ size = 30 }: { size?: number }) {
  const dots = useMemo(() => {
    const rnd = seeded(19);
    const out: [number, number, number][] = [];
    for (let i = 0; i < 520 && out.length < 230; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 14;
      const x = 16 + Math.cos(a) * r;
      const y = 16 + Math.sin(a) * r;
      const shade = ((x - 6) + (y - 6)) / 28 + (r / 14) * 0.35;
      if (rnd() < shade * shade) out.push([x, y, 0.55 + rnd() * 0.45]);
    }
    return out;
  }, []);
  return <svg className="stipple-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    {dots.map(([x, y, r], i) => <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r={r.toFixed(2)}/>)}
  </svg>;
}
