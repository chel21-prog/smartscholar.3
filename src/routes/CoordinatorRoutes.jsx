import { Routes, Route } from "react-router-dom";
import PortalLayout from "@/layouts/PortalLayout";
import Dashboard from "@/pages/coordinator/Dashboard";
import Scholarships from "@/pages/coordinator/Scholarships";
import Students from "@/pages/coordinator/Students";
import Grantees from "@/pages/coordinator/Grantees";
import CoordinatorApplications from "@/pages/coordinator/CoordinatorApplications";
import Requirements from "@/pages/coordinator/Requirements";
import ReportBuilder from "@/pages/coordinator/ReportBuilder";
import Settings from "@/pages/settings/Settings";

const LINKS = [
  { to: "/coordinator/dashboard",    label: "Dashboard"     },
  { to: "/coordinator/scholarships", label: "Scholarships"  },
  { to: "/coordinator/students",     label: "Students"      },
  { to: "/coordinator/grantees",     label: "Grantees"      },
  { to: "/coordinator/applications", label: "Applications"  },
  { to: "/coordinator/requirements", label: "Requirements"  },
  { to: "/coordinator/reports",      label: "Report Builder"},
  { to: "/coordinator/settings",     label: "Settings"      },
];

export default function CoordinatorRoutes() {
  return (
    <Routes>
      <Route element={<PortalLayout roleLabel="Coordinator Portal" links={LINKS} />}>
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="scholarships" element={<Scholarships />} />
        <Route path="students"     element={<Students />} />
        <Route path="grantees"     element={<Grantees />} />
        <Route path="applications" element={<CoordinatorApplications />} />
        <Route path="requirements" element={<Requirements />} />
        <Route path="reports"      element={<ReportBuilder />} />
        <Route path="settings"     element={<Settings />} />
      </Route>
    </Routes>
  );
}
