import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import RoleGuard from "@/components/RoleGuard";
import ProfileGuard from "@/components/ProfileGuard";
import Dashboard from "@/pages/student/Dashboard";
import Profile from "@/pages/student/Profile";
import Applications from "@/pages/student/Applications";
import Compliance from "@/pages/student/Compliance";
import Settings from "@/pages/settings/Settings";

const LINKS = [
  { to: "/student/dashboard",    label: "Dashboard"    },
  { to: "/student/profile",      label: "Profile"      },
  { to: "/student/applications", label: "Applications" },
  { to: "/student/compliance",   label: "Compliance"   },
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
        <Route path="settings"     element={<Settings />} />
      </Route>
    </Routes>
  );
}
