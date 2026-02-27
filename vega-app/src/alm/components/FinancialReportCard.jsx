// ═══════════════════════════════════════════════
// ALM — Financial Report Card
// Two modes:
//   1 home  → detailed report card + line items
//   2+ homes → side-by-side comparison + rankings
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';
import REPORT_CARD_DATA from '../data/reportCardData';

const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };
const sans  = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

// Build a single-period fallback from the multi-period static data (latest period)
const FALLBACK_PERIOD = (() => {
  const p = REPORT_CARD_DATA.periods;
  const latest = p[p.length - 1];
  return {
    month: latest.month,
    year: latest.year,
    revenueLabels: REPORT_CARD_DATA.revenueLabels,
    expenseLabels: REPORT_CARD_DATA.expenseLabels,
    homes: latest.homes,
  };
})();

// ── Grading ────────────────────────────────────────────────

const GRADE_SCALE = [
  { min: 1.10, letter: 'A+', gpa: 4.3 },
  { min: 1.03, letter: 'A',  gpa: 4.0 },
  { min: 0.98, letter: 'A-', gpa: 3.7 },
  { min: 0.95, letter: 'B+', gpa: 3.3 },
  { min: 0.90, letter: 'B',  gpa: 3.0 },
  { min: 0.85, letter: 'B-', gpa: 2.7 },
  { min: 0.80, letter: 'C+', gpa: 2.3 },
  { min: 0.75, letter: 'C',  gpa: 2.0 },
  { min: 0.70, letter: 'C-', gpa: 1.7 },
  { min: 0.00, letter: 'D',  gpa: 1.0 },
];

function gradeFromRatio(ratio) {
  for (const g of GRADE_SCALE) {
    if (ratio >= g.min) return g;
  }
  return GRADE_SCALE[GRADE_SCALE.length - 1];
}

function gradeFromGpa(gpa) {
  for (const g of GRADE_SCALE) {
    if (gpa >= g.gpa - 0.01) return g;
  }
  return GRADE_SCALE[GRADE_SCALE.length - 1];
}

function gradeColor(gpa) {
  if (gpa >= 3.7) return 'var(--alm-neptune)';
  if (gpa >= 2.7) return 'var(--alm-plum)';
  if (gpa >= 1.7) return 'var(--alm-warning)';
  return 'var(--alm-danger)';
}

function gradeComment(gpa) {
  if (gpa >= 4.0) return 'Excellent month.';
  if (gpa >= 3.5) return 'Strong performance.';
  if (gpa >= 3.0) return 'Solid results.';
  if (gpa >= 2.5) return 'Room to grow.';
  if (gpa >= 2.0) return 'Needs attention.';
  return 'Action required.';
}

// Compute a home's overall GPA from its 4 categories
function computeHomeGpa(home) {
  const revRatio = home.revenue.actual / home.revenue.budget;
  const expRatio = home.expenses.budget / home.expenses.actual; // inverse
  const occRatio = home.occupancy.actual / home.occupancy.budget;
  const noiRatio = home.noi.actual / home.noi.budget;
  const gpas = [revRatio, expRatio, occRatio, noiRatio].map((r) => gradeFromRatio(r).gpa);
  return gpas.reduce((a, b) => a + b, 0) / gpas.length;
}

// ── Formatters ─────────────────────────────────────────────

function fmtK(n) {
  if (n == null) return '--';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n) {
  return n == null ? '--' : `${n.toFixed(1)}%`;
}

// ── Plum Star ──────────────────────────────────────────────

function PlumStar({ size = 12, style = {} }) {
  return (
    <svg viewBox="0 0 100 133" style={{ width: size * 0.75, height: size, flexShrink: 0, ...style }}>
      <path
        d="M50,0c-4.4,30.83-13.78,55.14-25.67,66.55,11.89,11.41,21.27,35.71,25.67,66.55,4.4-30.83,13.78-55.14,25.67-66.55C63.78,55.14,54.4,30.83,50,0Z"
        fill="var(--alm-plum)"
      />
    </svg>
  );
}

// ── Grade Ring (SVG arc) ───────────────────────────────────

function GradeRing({ letter, gpa, size = 130 }) {
  const sw = 5;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(gpa / 4.3, 1));
  const color = gradeColor(gpa);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--alm-bd)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...serif, fontSize: 38, color, lineHeight: 1 }}>{letter}</span>
        <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', marginTop: 4 }}>{gpa.toFixed(1)} GPA</span>
      </div>
    </div>
  );
}

// ── Category Row (single-home view) ────────────────────────

function CategoryRow({ label, actual, budget, priorMonth, inverse, isCurrency, isLast }) {
  const ratio = inverse ? budget / actual : actual / budget;
  const grade = gradeFromRatio(ratio);
  const color = gradeColor(grade.gpa);
  const pct = Math.round(ratio * 100);
  const barFill = Math.min(pct / 130 * 100, 100);
  const budgetMark = (100 / 130) * 100;

  const delta = actual - priorMonth;
  const deltaPct = priorMonth ? Math.abs((delta / priorMonth) * 100).toFixed(1) : '0.0';
  const trendGood = inverse ? delta <= 0 : delta >= 0;

  const vsLabel = isCurrency
    ? `${fmtK(actual)} vs ${fmtK(budget)} budget`
    : `${actual}% vs ${budget}% target`;

  return (
    <div style={{ padding: '16px 0', borderBottom: isLast ? 'none' : '1px solid var(--alm-bd)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t2)' }}>{label}</span>
        <span style={{
          ...sans, fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 4,
          background: grade.gpa >= 3.7 ? 'var(--alm-neptune-bg)' : 'var(--alm-plum-bg)',
          color, letterSpacing: '0.05em',
        }}>
          {grade.letter}
        </span>
      </div>
      <div style={{ position: 'relative', height: 5, borderRadius: 3, background: 'var(--alm-bd)', marginBottom: 10 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${barFill}%`, background: color, transition: 'width 0.6s ease-out' }} />
        <div style={{ position: 'absolute', left: `${budgetMark}%`, top: -3, height: 11, width: 1, background: 'var(--alm-t4)', borderRadius: 1 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
          {vsLabel} &middot; {pct}%
        </span>
        <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: trendGood ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
          {trendGood ? '\u2197' : '\u2198'} {deltaPct}% vs prior mo
        </span>
      </div>
    </div>
  );
}

// ── Line Item Row (single-home breakdown) ──────────────────

function LineItemRow({ label, actual, budget, inverse }) {
  const ratio = inverse ? budget / actual : actual / budget;
  const pct = Math.round(ratio * 100);
  const overUnder = inverse ? budget - actual : actual - budget;
  const isGood = overUnder >= 0;
  const barFill = Math.min(pct / 120 * 100, 100);
  const markPos = (100 / 120) * 100;
  const color = isGood ? 'var(--alm-neptune)' : 'var(--alm-danger)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 50px 1fr', gap: 12, alignItems: 'center', padding: '8px 0' }}>
      <span style={{ ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t2)' }}>{label}</span>
      <span style={{ ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t1)', textAlign: 'right' }}>
        {fmtK(actual)} <span style={{ fontWeight: 400, color: 'var(--alm-t4)' }}>/ {fmtK(budget)}</span>
      </span>
      <span style={{ ...sans, fontSize: 11, fontWeight: 400, color, textAlign: 'right' }}>{pct}%</span>
      <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--alm-bd)' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${barFill}%`, background: color, transition: 'width 0.5s ease-out' }} />
        <div style={{ position: 'absolute', left: `${markPos}%`, top: -2, height: 8, width: 1, background: 'var(--alm-t5)' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SINGLE HOME VIEW
// ═══════════════════════════════════════════════════════════

function SingleHomeView({ home, isMobile, reportData }) {
  const data = reportData;
  const gpa = computeHomeGpa(home);
  const overall = gradeFromGpa(gpa);
  const margin = (home.noi.actual / home.revenue.actual) * 100;

  return (
    <div>
      <div
        className="alm-card"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
          gap: isMobile ? 24 : 40,
          padding: isMobile ? 20 : 32,
          marginBottom: 16,
        }}
      >
        {/* Left: grade ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: isMobile ? undefined : 180, textAlign: 'center' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
              <PlumStar size={8} />
              <span className="alm-section-label" style={{ color: 'var(--alm-plum)' }}>{data.month} {data.year}</span>
            </div>
            <div style={{ ...serif, fontSize: 22, color: 'var(--alm-t1)', lineHeight: 1.2 }}>{home.name}</div>
          </div>
          <GradeRing letter={overall.letter} gpa={gpa} size={isMobile ? 110 : 130} />
          <div style={{ ...sans, fontSize: 12, fontWeight: 400, fontStyle: 'italic', color: 'var(--alm-t4)', marginTop: 16, maxWidth: 160, lineHeight: 1.4 }}>
            {gradeComment(gpa)}
          </div>
          <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 6, background: 'var(--alm-neptune-bg)', textAlign: 'center' }}>
            <div style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Monthly NOI</div>
            <div style={{ ...serif, fontSize: 22, color: 'var(--alm-neptune)', lineHeight: 1 }}>{fmtK(home.noi.actual)}</div>
            <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', marginTop: 2 }}>{fmtPct(margin)} margin</div>
          </div>
        </div>

        {/* Right: category breakdown */}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
            Category Breakdown
          </div>
          <CategoryRow label="Revenue" actual={home.revenue.actual} budget={home.revenue.budget} priorMonth={home.revenue.priorMonth} inverse={false} isCurrency />
          <CategoryRow label="Expenses" actual={home.expenses.actual} budget={home.expenses.budget} priorMonth={home.expenses.priorMonth} inverse isCurrency />
          <CategoryRow label="Occupancy" actual={home.occupancy.actual} budget={home.occupancy.budget} priorMonth={home.occupancy.priorMonth} inverse={false} isCurrency={false} />
          <CategoryRow label="Net Operating Income" actual={home.noi.actual} budget={home.noi.budget} priorMonth={home.noi.priorMonth} inverse={false} isCurrency isLast />
          <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>Source: QuickBooks Budget vs Actual</span>
            <span>{home.beds} beds</span>
          </div>
        </div>
      </div>

      {/* Line item breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Revenue items */}
        <div className="alm-card" style={{ padding: isMobile ? 16 : 24 }}>
          <div className="alm-section-label" style={{ color: 'var(--alm-plum)', marginBottom: 12 }}>Revenue Breakdown</div>
          {data.revenueLabels.map((label, i) => (
            <LineItemRow key={label} label={label} actual={home.revenue.items[i].actual} budget={home.revenue.items[i].budget} inverse={false} />
          ))}
        </div>
        {/* Expense items */}
        <div className="alm-card" style={{ padding: isMobile ? 16 : 24 }}>
          <div className="alm-section-label" style={{ color: 'var(--alm-plum)', marginBottom: 12 }}>Expense Breakdown</div>
          {data.expenseLabels.map((label, i) => (
            <LineItemRow key={label} label={label} actual={home.expenses.items[i].actual} budget={home.expenses.items[i].budget} inverse />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPARISON VIEW
// ═══════════════════════════════════════════════════════════

// Rank helper: returns array of 1-based ranks (1 = best)
function rankBy(homes, getValue, higherIsBetter = true) {
  const vals = homes.map((h, i) => ({ i, v: getValue(h) }));
  vals.sort((a, b) => higherIsBetter ? b.v - a.v : a.v - b.v);
  const ranks = new Array(homes.length);
  vals.forEach((item, pos) => { ranks[item.i] = pos + 1; });
  return ranks;
}

function RankBadge({ rank }) {
  if (rank !== 1) return null;
  return (
    <span style={{
      ...sans, fontSize: 10, fontWeight: 600,
      background: 'var(--alm-plum-bg)', color: 'var(--alm-plum)',
      padding: '1px 6px', borderRadius: 3, marginLeft: 6,
      letterSpacing: '0.05em',
    }}>
      #1
    </span>
  );
}

function ComparisonView({ homes, isMobile, reportData }) {
  const data = reportData;
  const colCount = homes.length;

  // Pre-compute GPAs
  const gpas = homes.map(computeHomeGpa);

  // Rankings for summary rows
  const revRanks  = rankBy(homes, (h) => h.revenue.actual / h.revenue.budget);
  const expRanks  = rankBy(homes, (h) => h.expenses.budget / h.expenses.actual);
  const occRanks  = rankBy(homes, (h) => h.occupancy.actual / h.occupancy.budget);
  const noiRanks  = rankBy(homes, (h) => h.noi.actual / h.noi.budget);
  const margRanks = rankBy(homes, (h) => h.noi.actual / h.revenue.actual);

  // Cell style helpers
  const cellStyle = { padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--alm-bd)' };
  const labelStyle = { ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t2)', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--alm-bd)' };
  const sectionHeaderStyle = {
    ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-plum)',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    padding: '12px 12px 6px', borderBottom: '1px solid var(--alm-bd)',
    background: 'var(--alm-plum-bg)',
  };

  function ValueCell({ actual, budget, inverse, rank }) {
    const ratio = inverse ? budget / actual : actual / budget;
    const pct = Math.round(ratio * 100);
    const isGood = inverse ? actual <= budget : actual >= budget;
    const pctColor = isGood ? 'var(--alm-neptune)' : 'var(--alm-danger)';

    return (
      <div style={cellStyle}>
        <div style={{ ...serif, fontSize: 15, color: 'var(--alm-t1)', lineHeight: 1.2 }}>
          {fmtK(actual)}
          <RankBadge rank={rank} />
        </div>
        <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: pctColor }}>
          {pct}% of budget
        </div>
      </div>
    );
  }

  function PctCell({ actual, budget, rank }) {
    const isGood = actual >= budget;
    return (
      <div style={cellStyle}>
        <div style={{ ...serif, fontSize: 15, color: 'var(--alm-t1)', lineHeight: 1.2 }}>
          {actual}%
          <RankBadge rank={rank} />
        </div>
        <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: isGood ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
          vs {budget}% target
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Grade cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {homes.map((home, i) => {
          const g = gradeFromGpa(gpas[i]);
          const color = gradeColor(gpas[i]);
          const bestGpa = Math.max(...gpas);
          const isBest = gpas[i] === bestGpa;
          return (
            <div
              key={home.name}
              className="alm-card"
              style={{
                textAlign: 'center', padding: '20px 16px',
                borderTop: `3px solid ${color}`,
              }}
            >
              <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {home.name}
              </div>
              <div style={{ ...serif, fontSize: 36, color, lineHeight: 1 }}>
                {g.letter}
              </div>
              <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', marginTop: 4 }}>
                {gpas[i].toFixed(1)} GPA
              </div>
              <div style={{ ...sans, fontSize: 11, fontWeight: 400, fontStyle: 'italic', color: 'var(--alm-t4)', marginTop: 6 }}>
                {gradeComment(gpas[i])}
              </div>
              {isBest && (
                <div style={{ ...sans, fontSize: 10, fontWeight: 600, color: 'var(--alm-plum)', marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Top Performer
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="alm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `minmax(160px, 200px) repeat(${colCount}, minmax(120px, 1fr))`,
            minWidth: 160 + colCount * 140,
          }}>

            {/* Column headers */}
            <div style={{ ...sectionHeaderStyle, background: 'transparent', borderBottom: '2px solid var(--alm-bd)' }} />
            {homes.map((home) => (
              <div key={home.name} style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t1)', textAlign: 'right', padding: '12px 12px 6px', borderBottom: '2px solid var(--alm-bd)', letterSpacing: '0.05em' }}>
                {home.name}
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--alm-t4)', marginTop: 2 }}>{home.beds} beds</div>
              </div>
            ))}

            {/* ── REVENUE SECTION ── */}
            <div style={{ ...sectionHeaderStyle, gridColumn: `1 / -1` }}>Revenue</div>

            {data.revenueLabels.map((label, li) => {
              const ranks = rankBy(homes, (h) => h.revenue.items[li].actual / h.revenue.items[li].budget);
              return [
                <div key={`rl-${li}`} style={labelStyle}>{label}</div>,
                ...homes.map((home, hi) => (
                  <ValueCell key={`rv-${li}-${hi}`} actual={home.revenue.items[li].actual} budget={home.revenue.items[li].budget} inverse={false} rank={ranks[hi]} />
                )),
              ];
            })}

            {/* Revenue total */}
            <div style={{ ...labelStyle, fontWeight: 400, color: 'var(--alm-t1)' }}>Total Revenue</div>
            {homes.map((home, hi) => (
              <ValueCell key={`rt-${hi}`} actual={home.revenue.actual} budget={home.revenue.budget} inverse={false} rank={revRanks[hi]} />
            ))}

            {/* ── EXPENSE SECTION ── */}
            <div style={{ ...sectionHeaderStyle, gridColumn: `1 / -1` }}>Expenses</div>

            {data.expenseLabels.map((label, li) => {
              const ranks = rankBy(homes, (h) => h.expenses.items[li].budget / h.expenses.items[li].actual);
              return [
                <div key={`el-${li}`} style={labelStyle}>{label}</div>,
                ...homes.map((home, hi) => (
                  <ValueCell key={`ev-${li}-${hi}`} actual={home.expenses.items[li].actual} budget={home.expenses.items[li].budget} inverse rank={ranks[hi]} />
                )),
              ];
            })}

            {/* Expense total */}
            <div style={{ ...labelStyle, fontWeight: 400, color: 'var(--alm-t1)' }}>Total Expenses</div>
            {homes.map((home, hi) => (
              <ValueCell key={`et-${hi}`} actual={home.expenses.actual} budget={home.expenses.budget} inverse rank={expRanks[hi]} />
            ))}

            {/* ── BOTTOM LINE ── */}
            <div style={{ ...sectionHeaderStyle, gridColumn: `1 / -1` }}>Bottom Line</div>

            {/* NOI */}
            <div style={labelStyle}>Net Operating Income</div>
            {homes.map((home, hi) => (
              <ValueCell key={`noi-${hi}`} actual={home.noi.actual} budget={home.noi.budget} inverse={false} rank={noiRanks[hi]} />
            ))}

            {/* Margin */}
            <div style={labelStyle}>Operating Margin</div>
            {homes.map((home, hi) => {
              const margin = (home.noi.actual / home.revenue.actual * 100).toFixed(1);
              return (
                <div key={`mg-${hi}`} style={cellStyle}>
                  <div style={{ ...serif, fontSize: 15, color: 'var(--alm-t1)', lineHeight: 1.2 }}>
                    {margin}%
                    <RankBadge rank={margRanks[hi]} />
                  </div>
                </div>
              );
            })}

            {/* Occupancy */}
            <div style={{ ...labelStyle, borderBottom: 'none' }}>Occupancy</div>
            {homes.map((home, hi) => (
              <PctCell key={`oc-${hi}`} actual={home.occupancy.actual} budget={home.occupancy.budget} rank={occRanks[hi]} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--alm-bd)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
            Source: QuickBooks Budget vs Actual &middot; {data.month} {data.year}
          </span>
          <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
            {homes.length} homes compared
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function FinancialReportCard({ selectedHomes = [], reportData: reportDataProp }) {
  const { isMobile } = useResponsive();
  const data = reportDataProp || FALLBACK_PERIOD;

  // Resolve selected home names to data objects
  const homes = selectedHomes
    .map((name) => data.homes.find((h) => h.name === name))
    .filter(Boolean);

  if (homes.length === 0) {
    return (
      <div className="alm-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <PlumStar size={16} style={{ margin: '0 auto 12px' }} />
        <div style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t4)', lineHeight: 1.5 }}>
          Select a home above to view its financial report card,
          <br />or select multiple to compare side by side.
        </div>
      </div>
    );
  }

  return (
    <div>
      {homes.length === 1
        ? <SingleHomeView home={homes[0]} isMobile={isMobile} reportData={data} />
        : <ComparisonView homes={homes} isMobile={isMobile} reportData={data} />
      }
    </div>
  );
}
