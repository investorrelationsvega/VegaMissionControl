// ═══════════════════════════════════════════════
// ALM — Line Chart (lightweight SVG, no deps)
// Supports 1–2 overlaid series with a shared x-axis
// and optional secondary y-axis.
// ═══════════════════════════════════════════════

import { fmtNum, fmtDateShort } from '../utils/format';

const SERIES_COLORS = ['#222222', '#8a8a8a'];

export default function AlmLineChart({
  series = [],              // [{ name, color?, points: [{x: Date, y: number}], axis: 'left'|'right' }]
  height = 180,
  yLabel = '',
  rightYLabel = '',
}) {
  const allPoints = series.flatMap((s) => s.points.filter((p) => p.y != null));
  if (allPoints.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--alm-text-faint)' }}>
        No data in range
      </div>
    );
  }

  const W = 720;
  const H = height;
  const PAD_L = 36;
  const PAD_R = 36;
  const PAD_T = 12;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allDates = allPoints.map((p) => p.x.getTime()).sort((a, b) => a - b);
  const xMin = allDates[0];
  const xMax = allDates[allDates.length - 1];
  const xRange = Math.max(1, xMax - xMin);

  // Separate y-axes for left/right
  const leftPts = series.filter((s) => (s.axis || 'left') === 'left').flatMap((s) => s.points);
  const rightPts = series.filter((s) => s.axis === 'right').flatMap((s) => s.points);

  const yScale = (points) => {
    const ys = points.map((p) => p.y).filter((y) => y != null);
    if (ys.length === 0) return { min: 0, max: 1, range: 1 };
    const min = Math.min(0, ...ys);
    const max = Math.max(...ys, 1);
    return { min, max, range: max - min || 1 };
  };

  const left = yScale(leftPts);
  const right = yScale(rightPts);

  const xAt = (d) => PAD_L + ((d.getTime() - xMin) / xRange) * plotW;
  const yAt = (v, scale) => PAD_T + plotH - ((v - scale.min) / scale.range) * plotH;

  const linePath = (points, scale) => {
    const valid = points.filter((p) => p.y != null);
    if (valid.length === 0) return '';
    return valid
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.x).toFixed(1)},${yAt(p.y, scale).toFixed(1)}`)
      .join(' ');
  };

  // X-axis tick labels (first, middle, last)
  const firstDate = new Date(xMin);
  const lastDate = new Date(xMax);
  const midDate = new Date((xMin + xMax) / 2);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal grid lines (left scale) */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD_T + plotH * (1 - t);
          return (
            <line
              key={t}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="#eeeeee"
              strokeWidth={1}
            />
          );
        })}

        {/* Left y-axis labels */}
        {[0, 0.5, 1].map((t) => {
          const v = left.min + left.range * t;
          const y = PAD_T + plotH * (1 - t);
          return (
            <text key={t} x={PAD_L - 4} y={y + 3} fontSize={9} fill="#888" textAnchor="end">
              {fmtNum(Math.round(v))}
            </text>
          );
        })}

        {/* Right y-axis labels (only if there's a right series) */}
        {rightPts.length > 0 && [0, 0.5, 1].map((t) => {
          const v = right.min + right.range * t;
          const y = PAD_T + plotH * (1 - t);
          return (
            <text key={t} x={W - PAD_R + 4} y={y + 3} fontSize={9} fill="#888" textAnchor="start">
              {fmtNum(Math.round(v))}
            </text>
          );
        })}

        {/* X-axis labels */}
        {[firstDate, midDate, lastDate].map((d, i) => {
          const x = xAt(d);
          return (
            <text
              key={i}
              x={x}
              y={H - 10}
              fontSize={9}
              fill="#888"
              textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
            >
              {fmtDateShort(d)}
            </text>
          );
        })}

        {/* Series */}
        {series.map((s, i) => {
          const scale = (s.axis || 'left') === 'left' ? left : right;
          const color = s.color || SERIES_COLORS[i] || SERIES_COLORS[0];
          return (
            <g key={s.name}>
              <path d={linePath(s.points, scale)} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.filter((p) => p.y != null).map((p, j) => (
                <circle key={j} cx={xAt(p.x)} cy={yAt(p.y, scale)} r={2} fill={color} />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 4, fontSize: 11, color: 'var(--alm-text-muted)' }}>
        {series.map((s, i) => (
          <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 10,
              height: 2,
              background: s.color || SERIES_COLORS[i] || SERIES_COLORS[0],
              display: 'inline-block',
            }} />
            {s.name}
            {s.axis === 'right' && rightYLabel && <span style={{ color: 'var(--alm-text-faint)' }}>({rightYLabel})</span>}
            {s.axis !== 'right' && yLabel && i === 0 && <span style={{ color: 'var(--alm-text-faint)' }}>({yLabel})</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
