import { Routes, Route, Navigate } from "react-router-dom";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import StudentRoutes from "./routes/StudentRoutes";
import CoordinatorRoutes from "./routes/CoordinatorRoutes";
import CashierRoutes from "./routes/CashierRoutes";

function App() {
  return (
    <Routes>
      {/* DEFAULT ROUTE → redirect to signup */}
      <Route path="/" element={<Navigate to="/signup" replace />} />

      {/* AUTH */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/Login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* ROLE SYSTEMS */}
      <Route path="/student/*" element={<StudentRoutes />} />
      <Route path="/coordinator/*" element={<CoordinatorRoutes />} />
      <Route path="/cashier/*" element={<CashierRoutes />} />
    </Routes>
  );
}

export default App;