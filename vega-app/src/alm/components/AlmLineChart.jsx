// ═══════════════════════════════════════════════
// ALM — Line Chart (lightweight SVG, no deps)
// Overlays N series on a shared time axis. Each
// series is auto-normalized to its own min/max so
// metrics with different scales (e.g. census vs
// tours) can be compared for shape, not level.
// ═══════════════════════════════════════════════

import { fmtNum, fmtDateShort } from '../utils/format';

// Neutral palette — color alone isn't enough to differentiate
// many lines, so we pair grayscale shades with dash patterns.
const PALETTE = [
  { colorVar: 'var(--alm-ink-1)', dash: 'none'    },
  { colorVar: 'var(--alm-ink-3)', dash: 'none'    },
  { colorVar: 'var(--alm-ink-1)', dash: '5 3'     },
  { colorVar: 'var(--alm-ink-3)', dash: '5 3'     },
  { colorVar: 'var(--alm-ink-2)', dash: '1 3'     },
  { colorVar: 'var(--alm-ink-4)', dash: '1 3'     },
  { colorVar: 'var(--alm-ink-2)', dash: '8 3 2 3' },
  { colorVar: 'var(--alm-ink-4)', dash: '8 3 2 3' },
];
const styleFor = (i) => PALETTE[i % PALETTE.length];

const MONO_FONT = '"Space Mono", monospace';

export default function AlmLineChart({
  series = [],  // [{ name, points: [{x: Date, y: number|null}] }]
  height = 240,
  showLegend = true,
}) {
  const W = 720;
  const H = height;
  const PAD_L = 36;
  const PAD_R = 18;
  const PAD_T = 14;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allPoints = series.flatMap((s) => s.points.filter((p) => p.y != null));
  if (allPoints.length === 0 || series.length === 0) {
    return (
      <div
        className="alm-mono"
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--alm-ink-5)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}
      >
        {series.length === 0 ? 'Select one or more metrics' : 'No data in range'}
      </div>
    );
  }

  // Shared time axis
  const allDates = allPoints.map((p) => p.x.getTime()).sort((a, b) => a - b);
  const xMin = allDates[0];
  const xMax = allDates[allDates.length - 1];
  const xRange = Math.max(1, xMax - xMin);

  // Per-series independent y-scale
  const scales = series.map((s) => {
    const vals = s.points.map((p) => p.y).filter((y) => y != null);
    if (vals.length === 0) return { min: 0, max: 1, range: 1, hasData: false };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || Math.max(1, Math.abs(max) * 0.1);
    const lo = Math.min(min - pad, 0);
    const hi = max + pad;
    return { min: lo, max: hi, range: (hi - lo) || 1, hasData: true, actualMin: min, actualMax: max };
  });

  const xAt = (d) => PAD_L + ((d.getTime() - xMin) / xRange) * plotW;
  const yAt = (v, scale) => PAD_T + plotH - ((v - scale.min) / scale.range) * plotH;

  const linePath = (points, scale) => {
    const valid = points.filter((p) => p.y != null);
    if (valid.length === 0) return '';
    return valid
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.x).toFixed(1)},${yAt(p.y, scale).toFixed(1)}`)
      .join(' ');
  };

  const firstDate = new Date(xMin);
  const lastDate = new Date(xMax);
  const midDate = new Date((xMin + xMax) / 2);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + plotH * (1 - t);
          return (
            <line key={t} x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--alm-border)" strokeWidth={1} />
          );
        })}

        {/* X-axis labels */}
        {[firstDate, midDate, lastDate].map((d, i) => {
          const x = xAt(d);
          return (
            <text
              key={i}
              x={x}
              y={H - 8}
              fontSize={9}
              fontFamily={MONO_FONT}
              fill="var(--alm-ink-5)"
              textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {fmtDateShort(d)}
            </text>
          );
        })}

        {/* Left axis hint — "relative" since scales differ */}
        {series.length > 1 && (
          <>
            <text x={PAD_L - 6} y={PAD_T + 8} fontSize={8} fontFamily={MONO_FONT} fill="var(--alm-ink-5)" textAnchor="end" style={{ letterSpacing: '0.12em' }}>HIGH</text>
            <text x={PAD_L - 6} y={PAD_T + plotH} fontSize={8} fontFamily={MONO_FONT} fill="var(--alm-ink-5)" textAnchor="end" style={{ letterSpacing: '0.12em' }}>LOW</text>
          </>
        )}

        {/* Single-series: actual numeric y-axis */}
        {series.length === 1 && [0, 0.5, 1].map((t) => {
          const scale = scales[0];
          if (!scale.hasData) return null;
          const v = scale.min + scale.range * t;
          const y = PAD_T + plotH * (1 - t);
          return (
            <text
              key={t}
              x={PAD_L - 6}
              y={y + 3}
              fontSize={9}
              fontFamily={MONO_FONT}
              fill="var(--alm-ink-4)"
              textAnchor="end"
            >
              {fmtNum(Math.round(v))}
            </text>
          );
        })}

        {/* Series */}
        {series.map((s, i) => {
          const scale = scales[i];
          if (!scale.hasData) return null;
          const style = styleFor(i);
          return (
            <g key={s.name}>
              <path
                d={linePath(s.points, scale)}
                stroke={style.colorVar}
                strokeWidth={1.4}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={style.dash === 'none' ? undefined : style.dash}
              />
              {s.points.filter((p) => p.y != null).map((p, j) => (
                <circle key={j} cx={xAt(p.x)} cy={yAt(p.y, scale)} r={1.6} fill={style.colorVar} />
              ))}
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: 10,
            paddingTop: 12,
            borderTop: '1px solid var(--alm-border)',
          }}
        >
          {series.map((s, i) => {
            const style = styleFor(i);
            const scale = scales[i];
            return (
              <span
                key={s.name}
                className="alm-mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  color: 'var(--alm-ink-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}
              >
                <svg width="22" height="6" style={{ display: 'inline-block' }}>
                  <line
                    x1="0" y1="3" x2="22" y2="3"
                    stroke={style.colorVar}
                    strokeWidth="1.4"
                    strokeDasharray={style.dash === 'none' ? undefined : style.dash}
                  />
                </svg>
                <span style={{ color: 'var(--alm-ink-1)' }}>{s.name}</span>
                {scale.hasData && (
                  <span style={{ color: 'var(--alm-ink-5)' }}>
                    {fmtNum(Math.round(scale.actualMin))}–{fmtNum(Math.round(scale.actualMax))}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
