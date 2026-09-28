import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import RoleGuard from "@/components/RoleGuard";
const Dashboard = lazy(() => import("@/pages/cashier/Dashboard"));
const Grantees = lazy(() => import("@/pages/cashier/Grantees"));
const Funds = lazy(() => import("@/pages/cashier/Funds"));
const LiquidationReport = lazy(() => import("@/pages/cashier/LiquidationReport"));
const Settings = lazy(() => import("@/pages/settings/Settings"));

const LINKS = [
  { to: "/cashier/dashboard",   label: "Dashboard"           },
  { to: "/cashier/grantees",    label: "Grantees"            },
  { to: "/cashier/funds",       label: "Funds"                },
  { to: "/cashier/liquidation", label: "Liquidation Report"  },
  { to: "/cashier/settings",    label: "Settings"            },
];

export default function CashierRoutes() {
  return (
    <Routes>
      <Route element={
        <RoleGuard role="Cashier">
          <PortalLayout role="Cashier" roleLabel="Cashier Portal" links={LINKS} />
        </RoleGuard>
      }>
        <Route path="dashboard"   element={<Dashboard />} />
        <Route path="grantees"    element={<Grantees />} />
        <Route path="funds"       element={<Funds />} />
        <Route path="liquidation" element={<LiquidationReport />} />
        <Route path="settings"    element={<Settings />} />
      </Route>
    </Routes>
  );
}
