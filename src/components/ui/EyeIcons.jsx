/**
 * Minimal inline eye / eye-off icons (no icon library dependency).
 * Used for password-visibility toggle buttons.
 */
export function EyeIcon(props) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M1.5 12s4-7.5 10.5-7.5S22.5 12 22.5 12s-4 7.5-10.5 7.5S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon(props) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19.5C5.5 19.5 1.5 12 1.5 12a19.7 19.7 0 0 1 4.73-5.94M9.9 4.72A10.4 10.4 0 0 1 12 4.5c6.5 0 10.5 7.5 10.5 7.5a19.8 19.8 0 0 1-2.35 3.35M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
