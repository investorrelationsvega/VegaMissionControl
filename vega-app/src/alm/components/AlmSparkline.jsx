// ═══════════════════════════════════════════════
// ALM — Sparkline
// Minimal inline SVG line — no axes, no labels,
// no markers. Just the shape, for at-a-glance
// pulse inside stat cards.
// ═══════════════════════════════════════════════

export default function AlmSparkline({ points, width = 80, height = 20, stroke = 'var(--alm-ink-3)', strokeWidth = 1.2 }) {
  if (!points || points.length < 2) return null;

  const ys = points.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = yMax - yMin || 1;

  const PAD = 1.5;
  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;
  const xStep = innerW / (points.length - 1);

  const d = points
    .map((p, i) => {
      const x = PAD + i * xStep;
      const y = PAD + innerH * (1 - (p.value - yMin) / yRange);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
