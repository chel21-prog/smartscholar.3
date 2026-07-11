import { Navigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import PageLoader from "@/components/ui/PageLoader";

const ROLE_HOME = {
  Student: "/student/dashboard",
  Coordinator: "/coordinator/dashboard",
  Cashier: "/cashier/dashboard",
};

/**
 * Wrap a portal's route element with this to require:
 *  1. An active, logged-in session
 *  2. The signed-in user's role matching `role`
 *
 * Reads from the shared SessionContext instead of fetching its own —
 * see src/context/SessionContext.jsx.
 *
 * Not logged in           -> sent to /Login
 * Logged in, wrong role    -> sent to THEIR portal (not login — they're
 *                             already authenticated, just in the wrong place)
 * Logged in, right role    -> renders children as normal
 */
export default function RoleGuard({ role, children }) {
  const { loading, authUser, profile } = useSession();

  if (loading) {
    return <PageLoader label="Checking your account…" />;
  }

  if (!authUser || !profile) {
    return <Navigate to="/Login" replace />;
  }

  if (profile.status && profile.status !== "active") {
    // account suspended/disabled — treat like logged out
    return <Navigate to="/Login" replace />;
  }

  if (profile.role !== role) {
    return <Navigate to={ROLE_HOME[profile.role] || "/Login"} replace />;
  }

  return children;
}
