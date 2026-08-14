// A very small "stale-while-revalidate" cache, kept in memory for the
// life of the tab. First visit to a page still has to wait on the real
// network request; every visit after that renders the last-known data
// immediately (no spinner, no blank screen) while a fresh fetch happens
// silently in the background and quietly updates the screen if anything
// changed. Cleared on a full page reload — this is a UX cache, not a
// source of truth, so it deliberately doesn't try to survive a refresh.
const store = new Map();

export function getCached(key) {
  return store.has(key) ? store.get(key) : undefined;
}

export function setCached(key, value) {
  store.set(key, value);
}

export function clearCached(key) {
  store.delete(key);
}
