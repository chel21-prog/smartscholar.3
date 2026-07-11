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

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setState({ loading: false, authUser: null, profile: null });
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("user_id, role, status, first_name, middle_name, last_name, email")
      .eq("auth_id", user.id)
      .single();

    setState({ loading: false, authUser: user, profile: profile || null });
  }, []);

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setState((s) => ({ ...s, loading: true }));
      refresh();
    });

    return () => sub?.subscription?.unsubscribe();
  }, [refresh]);

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
