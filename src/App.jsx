import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import PageLoader from "@/components/ui/PageLoader";
import SiteNotice from "@/components/ui/SiteNotice";

import Login from "./pages/Login";

const Signup = lazy(() => import("./pages/Signup"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const StudentRoutes = lazy(() => import("./routes/StudentRoutes"));
const CoordinatorRoutes = lazy(() => import("./routes/CoordinatorRoutes"));
const CashierRoutes = lazy(() => import("./routes/CashierRoutes"));

const ROLE_HOME = {
  Student: "/student/dashboard",
  Coordinator: "/coordinator/dashboard",
  Cashier: "/cashier/dashboard",
};

function SmartRedirect() {
  const { loading, authUser, profile } = useSession();

  if (loading) return <PageLoader label="Signing you in…" />;

  if (!authUser || !profile) return <Navigate to="/Login" replace />;

  return <Navigate to={ROLE_HOME[profile.role] || "/Login"} replace />;
}

function App() {
  return (
    <>
    <SiteNotice />
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<SmartRedirect />} />

      {/* AUTH */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/Login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ROLE SYSTEMS */}
      <Route path="/student/*" element={<StudentRoutes />} />
      <Route path="/coordinator/*" element={<CoordinatorRoutes />} />
      <Route path="/cashier/*" element={<CashierRoutes />} />
    </Routes>
    </Suspense>
    </>
  );
}

export default App;