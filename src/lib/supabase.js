import { createClient } from "@supabase/supabase-js";

// Give this tab its own unique storage key. Supabase's client creates its
// OWN internal BroadcastChannel named after storageKey to sync auth state
// across tabs automatically (see GoTrueClient — it does this regardless of
// which storage backend is configured). storageKey defaults to the same
// value in every tab (it's derived from the project URL, not anything
// tab-specific), so switching to sessionStorage alone wasn't enough —
// every tab was still on Supabase's same built-in broadcast channel, which
// silently re-synced sign-out (and sign-in) across all of them anyway.
// Randomizing the key per tab stops that built-in cross-tab sync
// completely, leaving our own deliberate, account-scoped broadcast
// (src/lib/authSync.js) as the only thing left doing cross-tab signaling.
function getTabStorageKey() {
  const TAB_ID_KEY = "ss-tab-id";
  let tabId = window.sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = crypto.randomUUID();
    window.sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return `sb-smartscholar-auth-${tabId}`;
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: window.sessionStorage,
      storageKey: getTabStorageKey(),
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// ── "Remember me" (30 days) ─────────────────────────────────────────────
// Layered on top of the per-tab sessionStorage model above rather than
// replacing it. Every tab still gets its own private, tab-scoped session
// by default (see getTabStorageKey above) — that's what lets two
// different accounts stay signed in in two different tabs, and it's why
// a session normally disappears the moment its tab is closed.
//
// Checking "Remember me" at login additionally writes a copy of the
// session's tokens into localStorage (shared across tabs, unlike the
// per-tab key) next to an expiry timestamp. Any *new* tab — a freshly
// opened tab, or the browser reopened after being fully closed, either of
// which starts with empty sessionStorage — checks for this once on
// startup and, if it's present and not expired, restores it as that
// tab's session. Leaving "Remember me" unchecked, logging out, or
// deleting the account all clear it, and every tab still behaves exactly
// as before otherwise: gone the moment the tab is closed.
//
// Only one remembered session is kept at a time, since localStorage is a
// property of the browser rather than of any one tab. If a second
// account later checks "Remember me" on this same browser, it replaces
// the first — the same way "remember me" works in most apps.
const REMEMBER_ME_KEY = "ss-remember-me";
const REMEMBER_ME_DAYS = 30;

export function persistRememberMe(remember, session) {
  if (!remember || !session?.access_token || !session?.refresh_token) {
    clearRememberMe();
    return;
  }
  try {
    window.localStorage.setItem(
      REMEMBER_ME_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expiresAt: Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000,
      })
    );
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — "remember
    // me" just silently doesn't persist; a normal login still works fine.
  }
}

export function clearRememberMe() {
  try {
    window.localStorage.removeItem(REMEMBER_ME_KEY);
  } catch {
    // ignore
  }
}

/**
 * Run once, on startup, before this tab's first session check (see
 * SessionContext). If this tab already has its own session — it's an
 * already-open tab, or a duplicated one — this deliberately does nothing;
 * it must never override a session already active in this tab. Only a
 * genuinely fresh tab with no session of its own gets hydrated from the
 * remembered one, and only while it's still within its 30-day window.
 */
export async function hydrateRememberedSession() {
  let remembered;
  try {
    const raw = window.localStorage.getItem(REMEMBER_ME_KEY);
    if (!raw) return;
    remembered = JSON.parse(raw);
  } catch {
    clearRememberMe();
    return;
  }

  if (!remembered?.refresh_token || Date.now() > remembered.expiresAt) {
    clearRememberMe();
    return;
  }

  const {
    data: { session: existing },
  } = await supabase.auth.getSession();
  if (existing) return; // this tab is already signed in — leave it alone

  const { error } = await supabase.auth.setSession({
    access_token: remembered.access_token,
    refresh_token: remembered.refresh_token,
  });

  // Remembered session no longer valid (revoked, password changed
  // elsewhere, etc.) — stop trying to hydrate future tabs with it.
  if (error) clearRememberMe();
}