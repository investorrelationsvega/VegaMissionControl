// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Pipeline Status Tracker
// Visual pipeline bar showing subscription doc
// workflow stage for each investor
// ═══════════════════════════════════════════════

import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '../stores/investorStore';

const mono = { fontFamily: "'Space Mono', monospace" };

const STAGE_COLORS = {
  'New': { bg: 'var(--ylwM)', color: 'var(--ylw)', border: 'rgba(251,191,36,0.3)' },
  'Pending': { bg: 'var(--bluM)', color: 'var(--blu)', border: 'rgba(96,165,250,0.3)' },
  'Webform Sent': { bg: 'var(--bluM)', color: 'var(--blu)', border: 'rgba(96,165,250,0.3)' },
  'Webform Complete': { bg: 'var(--bluM)', color: 'var(--blu)', border: 'rgba(96,165,250,0.3)' },
  'DocuSign Out': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  'Fully Executed': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  'GP Countersign': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  'Funded': { bg: 'var(--grnM)', color: 'var(--grn)', border: 'rgba(52,211,153,0.3)' },
  'Accepted': { bg: 'var(--grnM)', color: 'var(--grn)', border: 'rgba(52,211,153,0.3)' },
  'Declined': { bg: 'var(--redM)', color: 'var(--red)', border: 'rgba(239,68,68,0.3)' },
};

// Compact badge for use in tables/lists
export function PipelineBadge({ stage }) {
  if (!stage) return null;
  const colors = STAGE_COLORS[stage] || STAGE_COLORS['Pending'];
  const label = PIPELINE_STAGE_LABELS[stage] || stage;

  return (
    <span
      style={{
        ...mono,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '3px 8px',
        borderRadius: 3,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {stage === 'New' && '● '}
      {label}
    </span>
  );
}

// "NEW" dot badge for list items
export function NewBadge() {
  return (
    <span
      style={{
        ...mono,
        fontSize: 8,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        padding: '2px 6px',
        borderRadius: 10,
        background: 'var(--ylw)',
        color: '#000',
        marginLeft: 6,
        animation: 'pulse 2s infinite',
      }}
    >
      NEW
    </span>
  );
}

// Full pipeline tracker bar for investor detail view
export default function PipelineTracker({ pipeline, signers, compact = false }) {
  if (!pipeline) return null;

  const currentStage = pipeline.stage;
  const isDeclined = currentStage === 'Declined';
  const currentIdx = isDeclined ? -1 : PIPELINE_STAGES.indexOf(currentStage);

  if (compact) {
    return <PipelineBadge stage={currentStage} />;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Stage labels */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          marginBottom: 6,
        }}
      >
        {PIPELINE_STAGES.map((stage, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;
          const colors = STAGE_COLORS[isCurrent ? stage : isPast ? 'Accepted' : 'Pending'];

          return (
            <div
              key={stage}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              {/* Connector line */}
              {idx > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 0,
                    right: '50%',
                    height: 2,
                    background: isPast || isCurrent ? 'var(--grn)' : 'var(--bd)',
                    zIndex: 0,
                  }}
                />
              )}
              {idx < PIPELINE_STAGES.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: '50%',
                    right: 0,
                    height: 2,
                    background: isPast ? 'var(--grn)' : 'var(--bd)',
                    zIndex: 0,
                  }}
                />
              )}

              {/* Dot */}
              <div
                style={{
                  width: isCurrent ? 18 : 10,
                  height: isCurrent ? 18 : 10,
                  borderRadius: '50%',
                  background: isCurrent
                    ? colors.color
                    : isPast
                      ? 'var(--grn)'
                      : 'var(--bd)',
                  border: isCurrent ? `2px solid ${colors.color}` : 'none',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {isPast && (
                  <svg viewBox="0 0 24 24" style={{ width: 8, height: 8, fill: '#000' }}>
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>

              {/* Label */}
              <div
                style={{
                  ...mono,
                  fontSize: 8,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? colors.color : isPast ? 'var(--t3)' : 'var(--t5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: 4,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {PIPELINE_STAGE_LABELS[stage]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Declined overlay */}
      {isDeclined && (
        <div
          style={{
            ...mono,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--red)',
            background: 'var(--redM)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            padding: '8px 12px',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          DECLINED {pipeline.declinedDate && `— ${new Date(pipeline.declinedDate).toLocaleDateString()}`}
        </div>
      )}

      {/* Signer status (when in DocuSign stage) */}
      {signers && signers.length > 0 && ['DocuSign Out', 'Fully Executed', 'GP Countersign'].includes(currentStage) && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            background: 'rgba(30,58,64,0.5)',
            border: '1px solid var(--bd)',
            borderRadius: 6,
          }}
        >
          <div
            style={{
              ...mono,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--t4)',
              marginBottom: 8,
            }}
          >
            Signers ({signers.filter((s) => s.signed).length} of {signers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {signers.map((signer, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Status icon */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: signer.signed ? 'var(--grnM)' : 'rgba(251,191,36,0.12)',
                    border: `1px solid ${signer.signed ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {signer.signed ? (
                    <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--grn)' }}>
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--ylw)' }}>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>

                {/* Name & role */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>
                    {signer.name}
                  </span>
                  <span
                    style={{
                      ...mono,
                      fontSize: 9,
                      color: 'var(--t4)',
                      marginLeft: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    {signer.role}
                  </span>
                </div>

                {/* Date */}
                <div style={{ ...mono, fontSize: 10, color: signer.signed ? 'var(--grn)' : 'var(--ylw)' }}>
                  {signer.signed && signer.signedDate
                    ? new Date(signer.signedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
