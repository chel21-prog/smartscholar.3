import { Link } from "react-router-dom";
import Icon from "./Icon";
import InfoTooltip from "./InfoTooltip";
import { PASSWORD_HINT } from "@/lib/passwordPolicy";
import styles from "@/styles/AuthExtras.module.css";

/**
 * Extra pieces for the Login / Signup pages. Presentation only: none of these
 * touch the auth logic. Navigation uses the app-wide redirect pattern
 * (see "Redirect pattern" in index.css): an arrow that nudges right on hover.
 */

/* Sign in / Create account switch (real links, so redirects behave like any other link) */
export function AuthTabs({ active }) {
  return (
    <nav className={styles.tabs} aria-label="Account">
      <Link to="/login" className={`${styles.tab} ${active === "login" ? styles.tabOn : ""}`}
        aria-current={active === "login" ? "page" : undefined}>Sign in</Link>
      <Link to="/signup" className={`${styles.tab} ${active === "signup" ? styles.tabOn : ""}`}
        aria-current={active === "signup" ? "page" : undefined}>Create account</Link>
    </nav>
  );
}

const MailIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 7.5l8 6 8-6" />
  </svg>
);

/* Input with a leading icon. `icon` is "mail" or "lock". */
export function IconField({ icon, children }) {
  return (
    <div className={styles.iconField}>
      <span className={styles.lead} aria-hidden="true">
        {icon === "lock" ? <Icon name="lock" size={16} /> : MailIcon}
      </span>
      {children}
    </div>
  );
}

/* Live checklist for the real password policy (lib/passwordPolicy.js) */
export function PasswordStrength({ value }) {
  const rules = [
    { ok: value.length >= 6, label: "6+ characters" },
    { ok: /[a-z]/.test(value), label: "Lowercase" },
    { ok: /[A-Z]/.test(value), label: "Uppercase" },
    { ok: /\d/.test(value), label: "Number" },
  ];
  const met = rules.filter((r) => r.ok).length;
  const level = !value ? "none" : met === 4 ? "strong" : met >= 2 ? "fair" : "weak";
  const word = { none: "", weak: "Weak", fair: "Almost there", strong: "Strong" }[level];
  return (
    <div className={styles.strength} data-level={level}>
      <div className={styles.strengthHead}>
        <span className={styles.strengthTitle}>
          Password strength
          <InfoTooltip label="Password rules" align="left">{PASSWORD_HINT}</InfoTooltip>
        </span>
        <span className={styles.strengthWord}>{word}</span>
      </div>
      <div className={styles.bars} aria-hidden="true">
        {rules.map((_, i) => <i key={i} className={i < met ? styles.barOn : ""} />)}
      </div>
      <ul className={styles.rules}>
        {rules.map((r) => (
          <li key={r.label} className={r.ok ? styles.ruleOk : ""}>
            <Icon name={r.ok ? "check" : "close"} size={11} /> {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 3-step "how it works", shown on the left side */
export function HowItWorks() {
  const steps = [
    ["Create your account", "Sign up with your email or Google."],
    ["Complete your profile", "Add your school details so we can match scholarships."],
    ["Apply and track", "Submit requirements and follow every decision."],
  ];
  return (
    <ol className={styles.how} aria-label="How it works">
      {steps.map(([t, d], i) => (
        <li key={t}>
          <span className={styles.howNum}>{i + 1}</span>
          <span><strong>{t}</strong><span className={styles.howDesc}>{d}</span></span>
        </li>
      ))}
    </ol>
  );
}

/* RA 10173 badge, with the same "i" hover info used on the dashboards */
export function PrivacyBadge() {
  return (
    <div className={styles.privacy}>
      <Icon name="lock" size={14} />
      <span>Protected under the Data Privacy Act (RA 10173)</span>
      <InfoTooltip label="Data privacy" align="left">
        Your name, email, academic records and uploaded documents are stored securely and used only for
        scholarship management. They are never shared with unauthorized third parties.
      </InfoTooltip>
    </div>
  );
}

/* In-form redirect link: the shared "go-link" style */
export function GoLink({ to, children }) {
  return <Link to={to} className="go-link">{children} <span className="go-arrow">→</span></Link>;
}
