import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import PageLoader from "@/components/ui/PageLoader";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import StudentRoutes from "./routes/StudentRoutes";
import CoordinatorRoutes from "./routes/CoordinatorRoutes";
import CashierRoutes from "./routes/CashierRoutes";

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
  );
}

export default App;