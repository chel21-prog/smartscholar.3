/**
 * Minimal inline nav icons, matched to a sidebar link by its label text.
 * Keeping this label-keyed (instead of requiring every route file to pass
 * an icon prop) means the icons "just work" for all three portals without
 * touching CoordinatorRoutes / CashierRoutes / StudentRoutes.
 */
const ICONS = {
  dashboard: (
    <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />
  ),
  scholarship: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M5 10.5V16c0 1.5 3 3 7 3s7-1.5 7-3v-5.5" />
    </>
  ),
  student: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5" />
    </>
  ),
  grantee: (
    <>
      <path d="M12 2l2.6 5.6L21 8.5l-4.5 4.2 1.1 6.3L12 16l-5.6 3 1.1-6.3L3 8.5l6.4-.9L12 2z" />
    </>
  ),
  application: (
    <>
      <path d="M7 3h7l4 4v14H7V3z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  requirement: (
    <>
      <path d="M9 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-3" />
      <path d="M9 5a1 1 0 011-1h4a1 1 0 011 1v1H9V5z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  fund: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 .9 3 2c0 3-6 1.5-6 4.5 0 1.1 1.3 2 3 2s3-1.1 3-2.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5" />
    </>
  ),
  compliance: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.36.4.66.74.85.28.16.6.24.92.24H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
};

function matchIcon(label) {
  const key = label.toLowerCase();
  if (key.includes("dashboard")) return ICONS.dashboard;
  if (key.includes("scholarship")) return ICONS.scholarship;
  if (key.includes("student")) return ICONS.student;
  if (key.includes("grantee")) return ICONS.grantee;
  if (key.includes("application")) return ICONS.application;
  if (key.includes("requirement")) return ICONS.requirement;
  if (key.includes("fund")) return ICONS.fund;
  if (key.includes("profile")) return ICONS.profile;
  if (key.includes("complian")) return ICONS.compliance;
  if (key.includes("setting")) return ICONS.settings;
  return ICONS.dashboard;
}

export default function NavIcon({ label, className }) {
  return (
    <svg
      className={className}
      width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {matchIcon(label)}
    </svg>
  );
}
