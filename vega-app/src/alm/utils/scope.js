// ═══════════════════════════════════════════════
// ALM — Scope
// A `scope` describes which facilities a view is
// looking at: everything, a single fund, or a
// single facility. Centralized so every page can
// share the same filter semantics.
// ═══════════════════════════════════════════════

import { FUNDS, fundForFacility } from '../config/funds';

export const ALL_SCOPE = { type: 'all' };

export function rowInScope(row, scope) {
  if (!scope || scope.type === 'all') return true;
  if (scope.type === 'facility') return row.facility === scope.value;
  if (scope.type === 'fund') {
    const fund = FUNDS.find((f) => f.id === scope.value);
    return fund ? fund.test(row.facility) : true;
  }
  return true;
}

export function facilityInScope(facility, scope) {
  if (!scope || scope.type === 'all') return true;
  if (scope.type === 'facility') return facility === scope.value;
  if (scope.type === 'fund') {
    const fund = FUNDS.find((f) => f.id === scope.value);
    return fund ? fund.test(facility) : true;
  }
  return true;
}

export function scopeLabel(scope) {
  if (!scope || scope.type === 'all') return 'All facilities';
  if (scope.type === 'facility') return scope.value;
  if (scope.type === 'fund') {
    const fund = FUNDS.find((f) => f.id === scope.value);
    return fund ? fund.label : 'Fund';
  }
  return '';
}

// For a facility pill, figure out whether it's "in" the active scope
// (highlighted normally) or "out" (dimmed). Used by the filter UI.
export function facilityMatchesScope(facility, scope) {
  if (!scope || scope.type === 'all') return true;
  if (scope.type === 'facility') return facility === scope.value;
  if (scope.type === 'fund') {
    const fund = FUNDS.find((f) => f.id === scope.value);
    return fund ? fund.test(facility) : false;
  }
  return true;
}

export { fundForFacility };
