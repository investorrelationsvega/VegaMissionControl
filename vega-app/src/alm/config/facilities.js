// ═══════════════════════════════════════════════
// ALM — Facility roster
// Canonical list of all homes. Used as the source
// of truth for the filter dropdown and the
// "X/N Homes Reporting" denominator, independent
// of who has actually submitted data. New homes
// are added here.
// ═══════════════════════════════════════════════

export const ALL_HOMES = [
  'All Seasons Senior Living of Cedar City',
  'Elk Ridge Assisted Living',
  'Hearthstone Manor Assisted Living',
  'Beehive Homes of Riverton',
  'Beehive Homes of Sandy',
  'Beehive Homes of West Jordan',
];

export const totalHomes = () => ALL_HOMES.length;
