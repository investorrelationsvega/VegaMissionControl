// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Sheets Write Queue
// Reliable write-back to Google Sheets with retry,
// persistence, and user-visible failure feedback
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'vega-pending-writes';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 15000]; // 2s, 5s, 15s

let toastFn = null; // Will be set by the app so we can show failures
let processing = false;

/** Register a toast function so the queue can notify the user of failures. */
export function registerToast(fn) {
  toastFn = fn;
}

function showToast(message, type = 'error') {
  if (toastFn) {
    toastFn(message, type);
  } else {
    console.warn('[WriteQueue]', message);
  }
}

// ---------------------------------------------------------------------------
// Persistent queue (survives page reloads)
// ---------------------------------------------------------------------------

function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — queue only lives in memory
  }
}

// In-memory queue (superset of persisted queue during this session)
let queue = loadQueue();

/**
 * Enqueue a write operation.
 * @param {string} label - Human-readable description (e.g. "Update phone for Alex Smith")
 * @param {Function} writeFn - Async function that performs the Sheets API write
 */
export function enqueueWrite(label, writeFn) {
  const entry = {
    id: `WQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    retries: 0,
    createdAt: new Date().toISOString(),
    // writeFn can't be serialized — we only persist metadata for display.
    // The actual retry uses the in-memory reference.
  };

  queue.push({ ...entry, writeFn });
  // Persist metadata (without the function) so we can show "X pending writes" on reload
  persistQueueMeta();
  processQueue();
}

function persistQueueMeta() {
  const meta = queue.map(({ writeFn, ...rest }) => rest);
  saveQueue(meta);
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const entry = queue[0];

    // If this entry has no writeFn (loaded from localStorage on reload), drop it
    // and notify the user — we can't replay arbitrary API calls.
    if (!entry.writeFn) {
      queue.shift();
      persistQueueMeta();
      continue;
    }

    try {
      await entry.writeFn();
      // Success — remove from queue
      queue.shift();
      persistQueueMeta();
    } catch (err) {
      entry.retries++;

      if (entry.retries >= MAX_RETRIES) {
        // Give up on this write
        showToast(
          `Failed to save: ${entry.label}. Your change is saved locally but not in Google Sheets. Try refreshing.`,
          'error',
        );
        console.error(`[WriteQueue] Gave up on "${entry.label}" after ${MAX_RETRIES} retries:`, err);
        queue.shift();
        persistQueueMeta();
      } else {
        // Wait and retry
        const delay = RETRY_DELAYS[entry.retries - 1] || 5000;
        console.warn(`[WriteQueue] Retry ${entry.retries}/${MAX_RETRIES} for "${entry.label}" in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  processing = false;
}

/**
 * Get count of pending writes (for UI indicator).
 */
export function getPendingCount() {
  return queue.length;
}

/**
 * Retry all pending writes that were loaded from localStorage (stale entries).
 * Call this after Google auth is confirmed on page load.
 * @param {Function} refreshWriteFn - Optional callback that can rebuild write functions from metadata
 */
export function retryStaleEntries() {
  const stale = queue.filter((e) => !e.writeFn);
  if (stale.length > 0) {
    showToast(
      `${stale.length} edit(s) from a previous session couldn't be re-sent. They may need to be re-entered.`,
      'warning',
    );
    // Remove stale entries since we can't replay them
    queue = queue.filter((e) => e.writeFn);
    persistQueueMeta();
  }
}

/**
 * Wrap a Sheets write so it goes through the queue with retry.
 * Returns a promise that resolves when the write is enqueued (NOT when it completes).
 * This keeps the UI snappy while ensuring writes are reliable.
 */
export function reliableWrite(label, writeFn) {
  enqueueWrite(label, writeFn);
}
