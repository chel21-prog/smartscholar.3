import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import Dashboard from "@/pages/cashier/Dashboard";
import Grantees from "@/pages/cashier/Grantees";
import Settings from "@/pages/settings/Settings";

const LINKS = [
  { to: "/cashier/dashboard", label: "Dashboard" },
  { to: "/cashier/grantees",  label: "Grantees"  },
  { to: "/cashier/settings",  label: "Settings"  },
];

export default function CashierRoutes() {
  return (
    <Routes>
      <Route element={<PortalLayout roleLabel="Cashier Portal" links={LINKS} />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="grantees"  element={<Grantees />} />
        <Route path="settings"  element={<Settings />} />
      </Route>
    </Routes>
  );
}
