// ═══════════════════════════════════════════════
// ALM — Data Hook
// Shared fetcher for the operations sheet.
// Caches the result module-wide so switching tabs
// doesn't refetch.
// ═══════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { fetchOperationsRows } from '../services/almDataService';

let cache = null;
let cachePromise = null;
let cacheAt = 0;
const TTL_MS = 60 * 1000;

function loadRows(force = false) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < TTL_MS) {
    return Promise.resolve(cache);
  }
  if (!force && cachePromise) return cachePromise;
  cachePromise = fetchOperationsRows()
    .then((rows) => {
      cache = rows;
      cacheAt = Date.now();
      cachePromise = null;
      return rows;
    })
    .catch((err) => {
      cachePromise = null;
      throw err;
    });
  return cachePromise;
}

export default function useAlmData() {
  const [rows, setRows] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(null);
  const [lastSynced, setLastSynced] = useState(cacheAt || null);

  const refresh = (force = true) => {
    setLoading(true);
    setError(null);
    loadRows(force)
      .then((r) => {
        setRows(r);
        setLastSynced(Date.now());
      })
      .catch((e) => setError(e.message || 'Failed to load sheet'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh(false);
  }, []);

  return { rows, loading, error, lastSynced, refresh };
}
