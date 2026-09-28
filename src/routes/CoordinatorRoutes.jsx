import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import RoleGuard from "@/components/RoleGuard";
const Dashboard = lazy(() => import("@/pages/coordinator/Dashboard"));
const Scholarships = lazy(() => import("@/pages/coordinator/Scholarships"));
const Students = lazy(() => import("@/pages/coordinator/Students"));
const Grantees = lazy(() => import("@/pages/coordinator/Grantees"));
const CoordinatorApplications = lazy(() => import("@/pages/coordinator/CoordinatorApplications"));
const Requirements = lazy(() => import("@/pages/coordinator/Requirements"));
const Payouts = lazy(() => import("@/pages/coordinator/Payouts"));
const Concerns = lazy(() => import("@/pages/coordinator/Concerns"));
const Settings = lazy(() => import("@/pages/settings/Settings"));

const LINKS = [
  { label: null, items: [
    { to: "/coordinator/dashboard", label: "Dashboard" },
  ]},
  { label: "Scholarships", items: [
    { to: "/coordinator/scholarships", label: "Scholarships" },
    { to: "/coordinator/students",     label: "Students"     },
    { to: "/coordinator/grantees",     label: "Grantees"     },
    { to: "/coordinator/applications", label: "Applications" },
    { to: "/coordinator/requirements", label: "Requirements" },
  ]},
  { label: "Finance & Support", items: [
    { to: "/coordinator/payouts",  label: "Payouts"  },
    { to: "/coordinator/concerns", label: "Concerns" },
  ]},
  { label: "Account", items: [
    { to: "/coordinator/settings", label: "Settings" },
  ]},
];

export default function CoordinatorRoutes() {
  return (
    <Routes>
      <Route element={
        <RoleGuard role="Coordinator">
          <PortalLayout role="Coordinator" roleLabel="Scholarship Coordinator Portal" links={LINKS} />
        </RoleGuard>
      }>
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="scholarships" element={<Scholarships />} />
        <Route path="students"     element={<Students />} />
        <Route path="grantees"     element={<Grantees />} />
        <Route path="applications" element={<CoordinatorApplications />} />
        <Route path="requirements" element={<Requirements />} />
        <Route path="payouts"      element={<Payouts />} />
        <Route path="concerns"     element={<Concerns />} />
        <Route path="settings"     element={<Settings />} />
      </Route>
    </Routes>
  );
}
