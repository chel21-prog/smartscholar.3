import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import StudentRoutes from "./routes/StudentRoutes";
import CoordinatorRoutes from "./routes/CoordinatorRoutes";
import CashierRoutes from "./routes/CashierRoutes";

function SmartRedirect() {
  const [destination, setDestination] = useState(null);

  useEffect(() => {
    const resolve = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setDestination("/Login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", session.user.id)
        .single();

      if (!profile) { setDestination("/Login"); return; }

      if (profile.role === "Student")     setDestination("/student/dashboard");
      else if (profile.role === "Coordinator") setDestination("/coordinator/dashboard");
      else if (profile.role === "Cashier")     setDestination("/cashier/dashboard");
      else setDestination("/Login");
    };

    resolve();
  }, []);

  if (!destination) return null; // briefly blank while checking session
  return <Navigate to={destination} replace />;
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