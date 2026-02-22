// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Shared KPI Components
// Reusable UI components for all KPI tabs
// ═══════════════════════════════════════════════

import { useState } from 'react';
import useResponsive from '../hooks/useResponsive';

const mono = { fontFamily: "'Space Mono', monospace" };

// ── Date Range Helpers ────────────────────────────────────────────────────────

function fmt(d) {
  return d.toISOString().split('T')[0];
}

export function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { type: 'month', start: fmt(start), end: fmt(end), label: 'This Month' };
}

export function getThisQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { type: 'quarter', start: fmt(start), end: fmt(end), label: 'This Quarter' };
}

export function getThisYearRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { type: 'year', start: fmt(start), end: fmt(end), label: 'This Year' };
}

export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtCurrency(n) {
  if (!n && n !== 0) return '-';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── DateRangeFilter ───────────────────────────────────────────────────────────

export function DateRangeFilter({ range, setRange }) {
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const options = [
    { key: 'month', label: 'This Month', fn: getThisMonthRange },
    { key: 'quarter', label: 'This Quarter', fn: getThisQuarterRange },
    { key: 'year', label: 'This Year', fn: getThisYearRange },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => {
            if (opt.fn) setRange(opt.fn());
            else setRange({ type: 'custom', start: customStart, end: customEnd, label: 'Custom' });
          }}
          style={{
            ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
            border: '1px solid', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
            borderColor: range.type === opt.key ? 'rgba(52,211,153,0.5)' : 'var(--bd)',
            background: range.type === opt.key ? 'rgba(52,211,153,0.1)' : 'transparent',
            color: range.type === opt.key ? 'var(--grn)' : 'var(--t4)',
          }}
        >
          {opt.label}
        </button>
      ))}
      {range.type === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <input
            type="date" value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              if (e.target.value && customEnd) {
                setRange({ type: 'custom', start: e.target.value, end: customEnd, label: 'Custom' });
              }
            }}
            style={{
              ...mono, fontSize: 10, background: 'var(--bg0)', border: '1px solid var(--bd)',
              borderRadius: 4, padding: '4px 8px', color: 'var(--t1)', outline: 'none',
            }}
          />
          <span style={{ ...mono, fontSize: 10, color: 'var(--t5)' }}>to</span>
          <input
            type="date" value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              if (customStart && e.target.value) {
                setRange({ type: 'custom', start: customStart, end: e.target.value, label: 'Custom' });
              }
            }}
            style={{
              ...mono, fontSize: 10, background: 'var(--bg0)', border: '1px solid var(--bd)',
              borderRadius: 4, padding: '4px 8px', color: 'var(--t1)', outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

export function StatusDot({ status, size = 8 }) {
  const colors = { green: 'var(--grn)', yellow: 'var(--ylw)', red: 'var(--red)' };
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: colors[status] || 'var(--t5)',
    }} />
  );
}

// ── KpiStatusCard ─────────────────────────────────────────────────────────────

export function KpiStatusCard({ label, value, target, status, unit, subtitle, onClick, expanded }) {
  const colors = { green: 'var(--grn)', yellow: 'var(--ylw)', red: 'var(--red)' };
  const borderColor = colors[status] || 'var(--bd)';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6,
        padding: '14px 16px', borderLeft: `3px solid ${borderColor}`,
        cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s',
        ...(expanded ? { boxShadow: `0 0 0 1px ${borderColor}` } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t4)' }}>
          {label}
        </span>
        <StatusDot status={status} />
      </div>
      <div style={{ ...mono, fontSize: 22, fontWeight: 300, color: 'var(--t1)' }}>
        {value ?? '-'}{unit && <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 2 }}>{unit}</span>}
      </div>
      {target && (
        <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginTop: 4 }}>
          Target: {target}
        </div>
      )}
      {subtitle && (
        <div style={{ ...mono, fontSize: 9, color: 'var(--t4)', marginTop: 2 }}>
          {subtitle}
        </div>
      )}
      {onClick && (
        <div style={{ ...mono, fontSize: 8, color: 'var(--t5)', marginTop: 6, textAlign: 'right' }}>
          {expanded ? '▾ collapse' : '▸ details'}
        </div>
      )}
    </div>
  );
}

// ── KpiDetailTable ────────────────────────────────────────────────────────────

export function KpiDetailTable({ columns, rows, onDelete }) {
  if (rows.length === 0) {
    return (
      <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 32 }}>
        No entries yet.
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 6, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
        gap: 0, background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', padding: '10px 14px',
      }}>
        {columns.map((col) => (
          <div key={col.key} style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)' }}>
            {col.label}
          </div>
        ))}
      </div>
      {/* Rows */}
      {rows.map((row, idx) => (
        <div key={row.id || idx} style={{
          display: 'grid', gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
          gap: 0, padding: '10px 14px', borderBottom: idx < rows.length - 1 ? '1px solid var(--bdS)' : 'none',
          fontSize: 12, color: 'var(--t2)',
        }}>
          {columns.map((col) => (
            <div key={col.key} style={{ ...mono, fontSize: 11, color: col.color ? col.color(row) : 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {col.render ? col.render(row) : (row[col.key] ?? '-')}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── KpiEntryModal ─────────────────────────────────────────────────────────────

export function KpiEntryModal({ title, fields, values, onChange, onSave, onClose, saveLabel = 'Save', saveDisabled = false, wide = false }) {
  const { isMobile } = useResponsive();
  const modalWidth = isMobile ? 'calc(100vw - 32px)' : wide ? 640 : 480;

  const inputStyle = {
    ...mono, fontSize: 12, width: '100%', boxSizing: 'border-box',
    background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4,
    padding: '8px 10px', color: 'var(--t1)', outline: 'none',
  };

  const labelStyle = {
    ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--t4)', display: 'block', marginBottom: 4,
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)', border: '1px solid var(--bdH)', borderRadius: 10,
          width: modalWidth, maxWidth: '100vw', maxHeight: '85vh', overflow: 'auto',
          boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
          <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--grn)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t4)', fontSize: 16, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            {fields.map((field) => {
              if (field.type === 'heading') {
                return (
                  <div key={field.key} style={{ gridColumn: '1 / -1', ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginTop: 8, marginBottom: -4 }}>
                    {field.label}
                  </div>
                );
              }
              if (field.fullWidth) {
                return (
                  <div key={field.key} style={{ gridColumn: '1 / -1' }}>
                    {renderField(field, values, onChange, labelStyle, inputStyle)}
                  </div>
                );
              }
              return (
                <div key={field.key}>
                  {renderField(field, values, onChange, labelStyle, inputStyle)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--bd)' }}>
          <button
            onClick={onClose}
            style={{ ...mono, fontSize: 11, padding: '8px 20px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 6, cursor: 'pointer' }}
          >Cancel</button>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            style={{
              ...mono, fontSize: 11, fontWeight: 700, padding: '8px 20px',
              border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)',
              color: saveDisabled ? 'var(--t5)' : 'var(--grn)', borderRadius: 6,
              cursor: saveDisabled ? 'not-allowed' : 'pointer', opacity: saveDisabled ? 0.5 : 1,
            }}
          >{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

function renderField(field, values, onChange, labelStyle, inputStyle) {
  const val = values[field.key] ?? '';

  if (field.type === 'select') {
    return (
      <div>
        <label style={labelStyle}>{field.label}</label>
        <select
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
          style={inputStyle}
        >
          <option value="">— Select —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
        <input
          type="checkbox"
          checked={!!val}
          onChange={(e) => onChange(field.key, e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <label style={{ ...mono, fontSize: 11, color: 'var(--t2)', cursor: 'pointer' }}>{field.label}</label>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label style={labelStyle}>{field.label}</label>
        <textarea
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
        />
      </div>
    );
  }

  return (
    <div>
      <label style={labelStyle}>{field.label}</label>
      <input
        type={field.type || 'text'}
        value={val}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder || ''}
        style={inputStyle}
        onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
      />
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const config = {
    on_time: { label: 'On Time', bg: 'var(--grnM)', color: 'var(--grn)' },
    late: { label: 'Late', bg: 'var(--redM)', color: 'var(--red)' },
    pending: { label: 'Pending', bg: 'var(--ylwM)', color: 'var(--ylw)' },
    reconciled: { label: 'Reconciled', bg: 'var(--grnM)', color: 'var(--grn)' },
    discrepancy: { label: 'Discrepancy', bg: 'var(--redM)', color: 'var(--red)' },
    open: { label: 'Open', bg: 'var(--ylwM)', color: 'var(--ylw)' },
    in_progress: { label: 'In Progress', bg: 'var(--bluM)', color: 'var(--blu)' },
    completed: { label: 'Completed', bg: 'var(--grnM)', color: 'var(--grn)' },
    clean: { label: 'Clean', bg: 'var(--grnM)', color: 'var(--grn)' },
  };
  const c = config[status?.toLowerCase()] || config[status] || { label: status || '-', bg: 'var(--bgM3)', color: 'var(--t4)' };

  return (
    <span style={{
      ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 3, background: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

// ── KpiSectionHeader ──────────────────────────────────────────────────────────

export function KpiSectionHeader({ title, onAdd, addLabel = '+ Log Entry', children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
          {title}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
              border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)',
              color: 'var(--grn)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({ message = 'No entries logged yet.' }) {
  return (
    <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 48 }}>
      {message}
    </div>
  );
}

// ── Export Button ─────────────────────────────────────────────────────────────

export function ExportButton({ onClick, label = 'Export CSV' }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
        border: '1px solid var(--bd)', background: 'transparent',
        color: 'var(--t4)', borderRadius: 6, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
