import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import RoleGuard from "@/components/RoleGuard";
import ProfileGuard from "@/components/ProfileGuard";
const Dashboard = lazy(() => import("@/pages/student/Dashboard"));
const Profile = lazy(() => import("@/pages/student/Profile"));
const Applications = lazy(() => import("@/pages/student/Applications"));
const Compliance = lazy(() => import("@/pages/student/Compliance"));
const Concerns = lazy(() => import("@/pages/student/Concerns"));
const Settings = lazy(() => import("@/pages/settings/Settings"));

const LINKS = [
  { to: "/student/dashboard",    label: "Dashboard"    },
  { to: "/student/profile",      label: "Profile"      },
  { to: "/student/applications", label: "Applications" },
  { to: "/student/compliance",   label: "Compliance"   },
  { to: "/student/concerns",     label: "Concerns"     },
  { to: "/student/settings",     label: "Settings"     },
];

export default function StudentRoutes() {
  return (
    <Routes>
      <Route element={
        <RoleGuard role="Student">
          <PortalLayout role="Student" roleLabel="Student Portal" links={LINKS} showNotifications />
        </RoleGuard>
      }>
        <Route path="dashboard"    element={<ProfileGuard><Dashboard /></ProfileGuard>} />
        <Route path="profile"      element={<Profile />} />
        <Route path="applications" element={<ProfileGuard><Applications /></ProfileGuard>} />
        <Route path="compliance"   element={<ProfileGuard><Compliance /></ProfileGuard>} />
        <Route path="concerns"     element={<ProfileGuard><Concerns /></ProfileGuard>} />
        <Route path="settings"     element={<Settings />} />
      </Route>
    </Routes>
  );
}
