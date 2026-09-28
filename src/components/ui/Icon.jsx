/**
 * Small inline icon set — replaces the emojis / text glyphs (✕ ✓ ⚠ 🔒 …)
 * that used to be scattered through the UI. Same drawing style as NavIcon
 * (24px grid, round-capped strokes, currentColor) so icons pick up the
 * surrounding text color and follow the navy / teal / gold theme in both
 * light and dark mode instead of rendering as platform-dependent emoji.
 *
 *   <Icon name="lock" size={14} />
 */
const PATHS = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9.5 16.5h-19L12 4z" />
      <path d="M12 10v4.2M12 17.3h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l4 4v14H7V3z" />
      <path d="M14 3v4h4M9.5 13h5M9.5 17h5" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-3" />
      <path d="M9 5a1 1 0 011-1h4a1 1 0 011 1v1H9V5z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H8l-4 4V5z" />
      <path d="M8.5 9.5h7M8.5 12.5h4" />
    </>
  ),
  cap: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M5 10.5V16c0 1.5 3 3 7 3s7-1.5 7-3v-5.5" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3h6M10 3v6l-3 4h10l-3-4V3" />
      <path d="M12 13v8" />
    </>
  ),
  upload: <path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
};

export default function Icon({ name, size = 16, strokeWidth = 2, className, style }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ verticalAlign: "-0.15em", flexShrink: 0, ...style }}
    >
      {paths}
    </svg>
  );
}
