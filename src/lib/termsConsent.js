// Remembers, on this browser, that the person agreed to the Terms & Data
// Privacy Policy so the checkbox on Login / Signup comes back already ticked.
// Unticking the box forgets it again.
const TERMS_KEY = "smartscholar.termsAccepted";

export function hasAcceptedTerms() {
  try {
    return !!window.localStorage.getItem(TERMS_KEY);
  } catch {
    return false;
  }
}

export function setAcceptedTerms(accepted) {
  try {
    if (accepted) {
      window.localStorage.setItem(TERMS_KEY, JSON.stringify({ acceptedAt: new Date().toISOString() }));
    } else {
      window.localStorage.removeItem(TERMS_KEY);
    }
  } catch {
    // localStorage unavailable — the checkbox just won't be remembered.
  }
}
