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