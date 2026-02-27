// ═══════════════════════════════════════════════
// ALM — Financial Report Card
// Turns monthly QuickBooks budget-vs-actual into
// a visual letter-grade report card per home.
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';
import REPORT_CARD_DATA from '../data/reportCardData';

const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };
const sans  = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

// ── Grading Logic ──────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────

function fmtK(n) {
  if (n == null) return '--';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

// ── Grade Ring (SVG) ───────────────────────────────────────

function GradeRing({ letter, gpa, size = 130 }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(gpa / 4.3, 1);
  const offset = circumference * (1 - progress);
  const color = gradeColor(gpa);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--alm-bd)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ ...serif, fontSize: 38, color, lineHeight: 1 }}>
          {letter}
        </span>
        <span style={{ ...sans, fontSize: 11, fontWeight: 300, color: 'var(--alm-t4)', marginTop: 4 }}>
          {gpa.toFixed(1)} GPA
        </span>
      </div>
    </div>
  );
}

// ── Category Row ───────────────────────────────────────────

function CategoryRow({ cat, isLast }) {
  // Performance ratio: how well did actual track to budget?
  const ratio = cat.inverse
    ? cat.budget / cat.actual    // for expenses: under budget = good
    : cat.actual / cat.budget;   // for revenue/noi/occ: over budget = good

  const grade = gradeFromRatio(ratio);
  const color = gradeColor(grade.gpa);
  const pct = Math.round(ratio * 100);

  // Bar: normalize so budget (100%) sits at ~75% of bar width
  // This leaves room to visually show overperformance
  const barFill = Math.min(pct / 130 * 100, 100); // cap at visual 100%
  const budgetMark = (100 / 130) * 100;            // where 100% sits on the bar

  // Month-over-month trend
  const delta = cat.actual - cat.priorMonth;
  const deltaPct = cat.priorMonth !== 0
    ? Math.abs((delta / cat.priorMonth) * 100).toFixed(1)
    : '0.0';
  // For expenses, a decrease is good
  const trendPositive = cat.inverse ? delta <= 0 : delta >= 0;

  // Format the actual vs budget label
  const vsLabel = cat.isCurrency
    ? `${fmtK(cat.actual)} vs ${fmtK(cat.budget)} budget`
    : `${cat.actual}% vs ${cat.budget}% target`;

  return (
    <div style={{
      padding: '16px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--alm-bd)',
    }}>
      {/* Top: label + grade badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10,
      }}>
        <span style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t2)' }}>
          {cat.label}
        </span>
        <span style={{
          ...sans, fontSize: 11, fontWeight: 500,
          padding: '2px 10px', borderRadius: 4,
          background: color === 'var(--alm-neptune)' ? 'var(--alm-neptune-bg)' : 'var(--alm-plum-bg)',
          color,
          letterSpacing: '0.05em',
        }}>
          {grade.letter}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'relative', height: 5, borderRadius: 3,
        background: 'var(--alm-bd)', marginBottom: 10, overflow: 'visible',
      }}>
        {/* Actual fill */}
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${barFill}%`,
          background: color,
          transition: 'width 0.6s ease-out',
        }} />
        {/* Budget marker line */}
        <div style={{
          position: 'absolute',
          left: `${budgetMark}%`,
          top: -3, height: 11, width: 1,
          background: 'var(--alm-t4)',
          borderRadius: 1,
        }} />
      </div>

      {/* Bottom: actual vs budget + trend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 300, color: 'var(--alm-t4)' }}>
          {vsLabel} &middot; {pct}%
        </span>
        <span style={{
          ...sans, fontSize: 11, fontWeight: 400,
          color: trendPositive ? 'var(--alm-neptune)' : 'var(--alm-danger)',
        }}>
          {trendPositive ? '\u2197' : '\u2198'} {deltaPct}% vs prior mo
        </span>
      </div>
    </div>
  );
}

// ── Plum Star (matches dashboard) ──────────────────────────

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

// ── Main Component ─────────────────────────────────────────

export default function FinancialReportCard() {
  const { isMobile } = useResponsive();
  const data = REPORT_CARD_DATA;

  // Calculate per-category grades
  const categoryGrades = data.categories.map((cat) => {
    const ratio = cat.inverse
      ? cat.budget / cat.actual
      : cat.actual / cat.budget;
    return { ...cat, grade: gradeFromRatio(ratio), ratio };
  });

  // Overall GPA = average of category GPAs
  const overallGpa = categoryGrades.reduce((s, c) => s + c.grade.gpa, 0) / categoryGrades.length;
  const overallGrade = gradeFromRatio(overallGpa / 4.3 + 0.69);
  // Simpler: just find the grade that matches the GPA
  const overallLetter = GRADE_SCALE.find((g) => overallGpa >= g.gpa - 0.01)?.letter || 'D';

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Section divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--alm-bd)' }} />
        <span className="alm-section-label">Financial Report Card</span>
        <div style={{ flex: 1, height: 1, background: 'var(--alm-bd)' }} />
      </div>

      <div
        className="alm-card"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
          gap: isMobile ? 24 : 40,
          padding: isMobile ? 20 : 32,
        }}
      >
        {/* ── Left: Grade ring + meta ─── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minWidth: isMobile ? undefined : 180,
          textAlign: 'center',
        }}>
          {/* Home + month label */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
              <PlumStar size={8} />
              <span className="alm-section-label" style={{ color: 'var(--alm-plum)' }}>
                {data.month} {data.year}
              </span>
            </div>
            <div style={{ ...serif, fontSize: 22, color: 'var(--alm-t1)', lineHeight: 1.2 }}>
              {data.home}
            </div>
          </div>

          {/* The ring */}
          <GradeRing letter={overallLetter} gpa={overallGpa} size={isMobile ? 110 : 130} />

          {/* Comment */}
          <div style={{
            ...sans, fontSize: 12, fontWeight: 300, fontStyle: 'italic',
            color: 'var(--alm-t4)', marginTop: 16,
            maxWidth: 160, lineHeight: 1.4,
          }}>
            {gradeComment(overallGpa)}
          </div>

          {/* NOI callout */}
          <div style={{
            marginTop: 16, padding: '10px 16px',
            borderRadius: 6, background: 'var(--alm-neptune-bg)',
            textAlign: 'center',
          }}>
            <div style={{ ...sans, fontSize: 9, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              Monthly NOI
            </div>
            <div style={{ ...serif, fontSize: 22, color: 'var(--alm-neptune)', lineHeight: 1 }}>
              {fmtK(data.categories.find((c) => c.key === 'noi')?.actual)}
            </div>
          </div>
        </div>

        {/* ── Right: Category breakdown ─── */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            ...sans, fontSize: 11, fontWeight: 400,
            color: 'var(--alm-t4)', textTransform: 'uppercase',
            letterSpacing: '0.12em', marginBottom: 4,
          }}>
            Category Breakdown
          </div>

          {data.categories.map((cat, i) => (
            <CategoryRow
              key={cat.key}
              cat={cat}
              isLast={i === data.categories.length - 1}
            />
          ))}

          {/* Source footer */}
          <div style={{
            ...sans, fontSize: 10, fontWeight: 300,
            color: 'var(--alm-t5)', marginTop: 12,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Source: QuickBooks Budget vs Actual</span>
            <span>{data.beds} beds &middot; {data.home}, UT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
