// ═══════════════════════════════════════════════
// ALM — Facility roster
// Canonical list of all homes. Names here must
// match exactly what the Apps Script writes to
// the "Daily Log" sheet. Capacities are hardcoded
// in the form and mirrored here so the dashboard
// can show occupancy %.
// ═══════════════════════════════════════════════

export const FACILITY_CONFIG = [
  {
    name: 'All Seasons Assisted Living of Cedar City',
    slug: 'cedar-city',
    capacity: 20,
    aliases: ['all seasons', 'cedar city', 'cedar-city', 'cedarcity', 'cedar'],
  },
  {
    name: 'Elkridge Assisted Living',
    slug: 'elkridge',
    capacity: 28,
    aliases: ['elkridge', 'elk ridge', 'elk-ridge', 'elk'],
  },
  {
    name: 'Hearthstone Assisted Living',
    slug: 'hearthstone',
    capacity: 35,
    aliases: ['hearthstone', 'hearth stone', 'hearthstone manor'],
  },
  {
    name: 'Beehive Homes of Riverton',
    slug: 'riverton',
    capacity: 16,
    aliases: ['riverton'],
  },
  {
    name: 'Beehive Homes of Sandy',
    slug: 'sandy',
    capacity: 16,
    aliases: ['sandy'],
  },
  {
    name: 'Beehive Homes of West Jordan',
    slug: 'west-jordan',
    capacity: 52,
    aliases: ['west jordan', 'west-jordan', 'westjordan'],
  },
];

export const ALL_HOMES = FACILITY_CONFIG.map((f) => f.name);

export const totalHomes = () => ALL_HOMES.length;

const _byName = new Map(FACILITY_CONFIG.map((f) => [f.name, f]));

export function facilityCapacity(name) {
  return _byName.get(name)?.capacity || 0;
}

export function facilitySlug(name) {
  return _byName.get(name)?.slug || '';
}

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
