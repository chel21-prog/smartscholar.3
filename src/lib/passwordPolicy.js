// Shared with ResetPassword.jsx and the new code-based reset flow in
// Login.jsx / Settings.jsx, so the rule and its message can't drift
// between the three places a "set a new password" form shows up.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
export const PASSWORD_HINT =
  "At least 6 characters, with an uppercase letter, a lowercase letter, and a number.";
