// ═══════════════════════════════════════════════
// ALM — Facility roster
// Canonical list of all homes. Used as the source
// of truth for the filter dropdown and the
// "X/N Homes Reporting" denominator, independent
// of who has actually submitted data. New homes
// are added here.
//
// `aliases` lets us map whatever variant of the
// facility name shows up in the sheet (slugs like
// "hearthstone" from the form URL, shortened names,
// typos) back to the canonical name. Each alias is
// matched as a case-insensitive substring.
// ═══════════════════════════════════════════════

export const FACILITY_CONFIG = [
  {
    name: 'All Seasons Senior Living of Cedar City',
    aliases: ['all seasons', 'cedar city', 'cedarcity', 'cedar'],
  },
  {
    name: 'Elk Ridge Assisted Living',
    aliases: ['elk ridge', 'elkridge', 'elk'],
  },
  {
    name: 'Hearthstone Manor Assisted Living',
    aliases: ['hearthstone', 'hearth stone'],
  },
  {
    name: 'Beehive Homes of Riverton',
    aliases: ['riverton'],
  },
  {
    name: 'Beehive Homes of Sandy',
    aliases: ['sandy'],
  },
  {
    name: 'Beehive Homes of West Jordan',
    aliases: ['west jordan', 'westjordan', 'west-jordan'],
  },
];

export const ALL_HOMES = FACILITY_CONFIG.map((f) => f.name);

export const totalHomes = () => ALL_HOMES.length;

// Map whatever the sheet calls a facility to the canonical name.
// Case-insensitive. Returns original (trimmed) if no match.
export function canonicalizeFacility(raw) {
  if (!raw) return raw;
  const lower = String(raw).toLowerCase().trim();
  if (!lower) return raw;

  // Exact canonical match
  for (const f of FACILITY_CONFIG) {
    if (lower === f.name.toLowerCase()) return f.name;
  }
  // Alias match (either direction — alias in raw, or raw in alias)
  for (const f of FACILITY_CONFIG) {
    for (const alias of f.aliases) {
      if (lower.includes(alias) || alias.includes(lower)) return f.name;
    }
  }
  return String(raw).trim();
}
