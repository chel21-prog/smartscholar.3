import { supabase } from "./supabase";

const CHANNEL_NAME = "smartscholar-auth-sync";

// BroadcastChannel isn't available in every environment (older Safari,
// some webviews) — degrade gracefully to "no cross-tab sync" rather than
// throwing, since sign-out for the current tab still works fine either way.
const channel = typeof BroadcastChannel !== "undefined"
  ? new BroadcastChannel(CHANNEL_NAME)
  : null;

/**
 * Signs the current tab out, and tells every other tab in this browser to
 * also sign out — but ONLY the tabs currently on the SAME account. Tabs
 * signed into a different account are left completely alone. This is what
 * lets multiple different accounts stay signed in simultaneously across
 * separate tabs (see supabase.js, which switched to per-tab sessionStorage
 * to make that possible in the first place — without this broadcast,
 * signing out in one tab would only ever affect that one tab).
 */
export async function signOutCurrentAccount() {
  const { data: { user } } = await supabase.auth.getUser();
  const authUserId = user?.id || null;

  await supabase.auth.signOut();

  if (channel && authUserId) {
    channel.postMessage({ type: "SIGNED_OUT", authUserId });
  }
}

/**
 * Subscribe once per tab (SessionContext does this). `getCurrentAuthUserId`
 * is a function (not a value) so it always reads the tab's latest signed-in
 * account, not whatever it was when this was first called. `onMatch` fires
 * only when the broadcasted sign-out is for the SAME account this tab is
 * currently on. Returns an unsubscribe function.
 */
export function onRemoteSignOut(getCurrentAuthUserId, onMatch) {
  if (!channel) return () => {};

  const handler = (event) => {
    if (event.data?.type !== "SIGNED_OUT") return;
    const currentId = getCurrentAuthUserId();
    if (currentId && event.data.authUserId === currentId) {
      onMatch();
    }
  };

  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}
