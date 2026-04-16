// ═══════════════════════════════════════════════
// ALM — Fund configuration
// Each facility belongs to a fund. Membership is
// determined by a substring test against the full
// facility name so sheet typos / naming variants
// ("All Seasons of West Jordan" vs "West Jordan")
// map to the same fund. Order matters: the first
// matching fund wins, so put the catch-all last.
// ═══════════════════════════════════════════════

export const FUNDS = [
  { id: 'fund1', label: 'Fund I',  test: (facility) => /west jordan/i.test(facility) },
  { id: 'fund2', label: 'Fund II', test: () => true },
];

export function fundForFacility(facility) {
  if (!facility) return null;
  return FUNDS.find((f) => f.test(facility)) || null;
}

export function facilitiesInFund(fundId, allFacilities) {
  const fund = FUNDS.find((f) => f.id === fundId);
  if (!fund) return [];
  return allFacilities.filter((fac) => fund.test(fac));
}

// Many sheet facility names follow the pattern
// "All Seasons Assisted Living of <City>" — pull the
// city/location off so pills don't sprawl.
export function shortFacility(name) {
  if (!name) return '';
  const match = /\bof\s+(.+)$/i.exec(name);
  return match ? match[1].trim() : name;
}
