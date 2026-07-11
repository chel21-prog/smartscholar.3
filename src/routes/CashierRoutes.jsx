import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import RoleGuard from "@/components/RoleGuard";
import Dashboard from "@/pages/cashier/Dashboard";
import Grantees from "@/pages/cashier/Grantees";
import Funds from "@/pages/cashier/Funds";
import Settings from "@/pages/settings/Settings";

const LINKS = [
  { to: "/cashier/dashboard", label: "Dashboard" },
  { to: "/cashier/grantees",  label: "Grantees"  },
   { to: "/cashier/funds",     label: "Funds"     },
  { to: "/cashier/settings",  label: "Settings"  },
];

export default function CashierRoutes() {
  return (
    <Routes>
      <Route element={
        <RoleGuard role="Cashier">
          <PortalLayout roleLabel="Cashier Portal" links={LINKS} />
        </RoleGuard>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="grantees"  element={<Grantees />} />
        <Route path="funds"     element={<Funds />} />
        <Route path="settings"  element={<Settings />} />
      </Route>
    </Routes>
  );
}
