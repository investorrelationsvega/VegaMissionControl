// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Pipeline Status Tracker
// Route-aware timeline (direct vs custodian) with
// editable dates on each stage
// ═══════════════════════════════════════════════

import { useState } from 'react';
import { getPipelineStages, PIPELINE_STAGE_LABELS, STAGE_DATE_KEYS } from '../stores/investorStore';

const mono = { fontFamily: "'Space Mono', monospace" };

const STAGE_COLORS = {
  'New': { bg: 'var(--ylwM)', color: 'var(--ylw)', border: 'rgba(251,191,36,0.3)' },
  'Pending': { bg: 'var(--bluM)', color: 'var(--blu)', border: 'rgba(96,165,250,0.3)' },
  'Webform Sent': { bg: 'var(--bluM)', color: 'var(--blu)', border: 'rgba(96,165,250,0.3)' },
  'Webform Done': { bg: 'var(--bluM)', color: 'var(--blu)', border: 'rgba(96,165,250,0.3)' },
  'Out for Signatures': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  'Signed by LP': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  'Signed by GP/Vega': { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.3)' },
  'Docs to Custodian': { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.3)' },
  'Delivered to Vega': { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.3)' },
  'Funded': { bg: 'var(--grnM)', color: 'var(--grn)', border: 'rgba(52,211,153,0.3)' },
  'Reviewed by Attorney': { bg: 'var(--grnM)', color: 'var(--grn)', border: 'rgba(52,211,153,0.3)' },
  'Blue Sky Filing': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'Fully Accepted': { bg: 'var(--grnM)', color: 'var(--grn)', border: 'rgba(52,211,153,0.3)' },
  'Declined': { bg: 'var(--redM)', color: 'var(--red)', border: 'rgba(239,68,68,0.3)' },
  // Legacy fallbacks
  'Accepted': { bg: 'var(--grnM)', color: 'var(--grn)', border: 'rgba(52,211,153,0.3)' },
};

function getDateForStage(pipeline, stage) {
  const dateKey = STAGE_DATE_KEYS[stage];
  if (!dateKey || !pipeline) return null;
  return pipeline[dateKey] || null;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  // YYYY-MM-DD strings are parsed as UTC by JS — force local timezone
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateShort(dateStr) {
  if (!dateStr) return null;
  try {
    const d = parseLocalDate(dateStr);
    if (!d) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

function toInputDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = parseLocalDate(dateStr);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return ''; }
}

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
// Props: pipeline, signers, docRouting, onDateChange(positionId, dateKey, newDate), positionId, compact
export default function PipelineTracker({ pipeline, signers, docRouting = 'direct', onDateChange, positionId, compact = false }) {
  const [editingStage, setEditingStage] = useState(null);

  if (!pipeline) return null;

  const currentStage = pipeline.stage;
  const isDeclined = currentStage === 'Declined';
  const stages = getPipelineStages(docRouting);
  const currentIdx = isDeclined ? -1 : stages.indexOf(currentStage);

  if (compact) {
    return <PipelineBadge stage={currentStage} />;
  }

  const handleDateClick = (stage) => {
    if (!onDateChange) return;
    setEditingStage(stage);
  };

  const handleDateCommit = (stage, value) => {
    const dateKey = STAGE_DATE_KEYS[stage];
    if (dateKey && onDateChange && positionId) {
      // Convert ISO date (YYYY-MM-DD from date input) to locale string
      // to avoid UTC-vs-local timezone display bugs (e.g. "2024-12-19"
      // parsed as UTC midnight shows as Dec 18 in US timezones).
      let safeValue = value;
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-').map(Number);
        safeValue = new Date(y, m - 1, d).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }); // e.g. "Dec 19, 2024"
      }
      onDateChange(positionId, dateKey, safeValue);
    }
    setEditingStage(null);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Stage labels */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          marginBottom: 6,
        }}
      >
        {stages.map((stage, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;
          const colors = STAGE_COLORS[isCurrent ? stage : isPast ? 'Fully Accepted' : 'Pending'];
          const stageDate = getDateForStage(pipeline, stage);
          const dateLabel = formatDateShort(stageDate);
          const isEditing = editingStage === stage;

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
              {idx < stages.length - 1 && (
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
                  fontSize: 7,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? colors.color : isPast ? 'var(--t3)' : 'var(--t5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  marginTop: 4,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  maxWidth: 60,
                }}
              >
                {PIPELINE_STAGE_LABELS[stage] || stage}
              </div>

              {/* Date display / editor */}
              {(isPast || isCurrent) && stage !== 'New' && (
                <div style={{ marginTop: 2, textAlign: 'center' }}>
                  {isEditing ? (
                    <input
                      type="date"
                      autoFocus
                      defaultValue={toInputDate(stageDate)}
                      onBlur={(e) => handleDateCommit(stage, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDateCommit(stage, e.target.value);
                        if (e.key === 'Escape') setEditingStage(null);
                      }}
                      style={{
                        ...mono,
                        fontSize: 9,
                        width: 90,
                        padding: '1px 2px',
                        border: '1px solid var(--blu)',
                        borderRadius: 3,
                        background: 'var(--bg0)',
                        color: 'var(--t1)',
                        textAlign: 'center',
                      }}
                    />
                  ) : (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDateClick(stage); }}
                      style={{
                        ...mono,
                        fontSize: 8,
                        color: 'var(--t4)',
                        cursor: onDateChange ? 'pointer' : 'default',
                        borderBottom: onDateChange ? '1px dashed var(--t5)' : 'none',
                        padding: '0 2px',
                      }}
                      title={onDateChange ? 'Click to edit date' : ''}
                    >
                      {dateLabel || (onDateChange ? '—' : '')}
                    </span>
                  )}
                  {/* Blue Sky deadline indicator */}
                  {stage === 'Blue Sky Filing' && isCurrent && pipeline.blueSkyDeadline && (
                    <div style={{
                      ...mono,
                      fontSize: 7,
                      fontWeight: 700,
                      color: new Date(pipeline.blueSkyDeadline) < new Date() ? 'var(--red)' : '#f59e0b',
                      marginTop: 2,
                    }}>
                      DUE {formatDateShort(pipeline.blueSkyDeadline)}
                    </div>
                  )}
                </div>
              )}
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

      {/* Signer status (when in signature stages) */}
      {signers && signers.length > 0 && ['Out for Signatures', 'Signed by LP', 'Signed by GP/Vega', 'Docs to Custodian', 'Delivered to Vega', 'DocuSign Out', 'Fully Executed', 'GP Countersign'].includes(currentStage) && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            background: 'var(--bgS)',
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
                    ? new Date(signer.signedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
