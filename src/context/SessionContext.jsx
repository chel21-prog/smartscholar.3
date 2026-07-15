import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SessionContext = createContext(null);

/**
 * Fetches the logged-in auth user + their `users` row ONCE at app start
 * and shares it everywhere via context, instead of every guard/component
 * (RoleGuard, ProfileGuard, NotificationBell, ...) each doing their own
 * `auth.getUser()` + `users` table round trip. This was the single
 * biggest contributor to slow initial page loads — 3+ redundant network
 * requests before any real content even started fetching.
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    authUser: null,
    profile: null, // { user_id, role, status, first_name, last_name, email }
  });

  const fetchSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { authUser: null, profile: null };

    const { data: profile } = await supabase
      .from("users")
      .select("user_id, role, status, first_name, middle_name, last_name, email")
      .eq("auth_id", user.id)
      .single();

    return { authUser: user, profile: profile || null };
  }, []);

  const refresh = useCallback(async () => {
    const result = await fetchSession();
    setState({ loading: false, ...result });
  }, [fetchSession]);

  useEffect(() => {
    refresh();

    // supabase fires onAuthStateChange for a lot more than just
    // sign-in/out — most notably TOKEN_REFRESHED, which happens
    // automatically in the background roughly every hour just to keep
    // the session alive. The old code treated every single event the
    // same way: flip to `loading: true` and refetch everything. That
    // meant a routine, invisible token refresh could momentarily bounce
    // the whole app into a loading screen, and if that refetch hit any
    // transient network hiccup, RoleGuard would see authUser === null
    // and redirect to /Login — a real, logged-in user getting kicked
    // out for no reason the user could see. Only SIGNED_OUT should ever
    // actually clear the session; everything else updates quietly
    // in the background without disrupting whatever the user is doing,
    // and without ever treating a failed background fetch as a logout.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setState({ loading: false, authUser: null, profile: null });
        return;
      }

      if (event === "SIGNED_IN") {
        setState((s) => ({ ...s, loading: true }));
        refresh();
        return;
      }

      // TOKEN_REFRESHED, USER_UPDATED, etc. — update quietly, and only
      // if it actually succeeds. A failed background check should never
      // by itself log an otherwise-active user out.
      fetchSession().then((result) => {
        if (result.authUser) {
          setState((s) => ({ ...s, ...result }));
        }
      });
    });

    return () => sub?.subscription?.unsubscribe();
  }, [refresh, fetchSession]);

  return (
    <SessionContext.Provider value={{ ...state, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
