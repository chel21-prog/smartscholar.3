import Icon from "@/components/ui/Icon";
import { useState } from "react";
import { hasAcceptedTerms, setAcceptedTerms } from "../lib/termsConsent";
import { supabase, persistRememberMe, clearRememberMe } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import styles from "@/styles/Auth.module.css";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { getMissingProfileFields } from "@/lib/profileCompleteness";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ForgotPasswordFlow from "@/components/ui/ForgotPasswordFlow";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(hasAcceptedTerms);
  const [remember, setRemember] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const navigate = useNavigate();

  // Shared by handleLogin and the "forgot password" code-verify success
  // path below — both end with an authenticated user who needs routing
  // to the right dashboard (or the profile page, if a student hasn't
  // finished filling theirs in yet).
  const routeAfterAuth = async (authUser, role) => {
    if (role === "Student") {
      const { data: userData } = await supabase
        .from("users")
        .select(`user_id, first_name, middle_name, last_name`)
        .eq("auth_id", authUser.id)
        .single();

      const { data: studentData } = await supabase
        .from("students")
        .select(`school_id, course, year_level, gender, ethnicity, contact_number`)
        .eq("user_id", userData.user_id)
        .single();

      const profileComplete = getMissingProfileFields(userData, studentData).length === 0;

      if (profileComplete) {
        navigate("/student/dashboard");
      } else {
        navigate("/student/profile", {
          state: {
            profileIncomplete: true,
            missingFields: getMissingProfileFields(userData, studentData).map(f => f.label),
          },
        });
      }
    } else if (role === "Coordinator") navigate("/coordinator/dashboard");
    else if (role === "Cashier") navigate("/cashier/dashboard");
    else navigate("/");
  };

  // The code-verify step in ForgotPasswordFlow already leaves the user
  // signed in (verifyOtp establishes a session) — no need to send them
  // back to the login form to type the password they just set.
  const handleResetSuccess = async (session) => {
    const authUser = session?.user;
    setShowForgot(false);
    if (!authUser) return;

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", authUser.id)
      .single();

    await routeAfterAuth(authUser, profile?.role);
  };
  

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!accepted) {
      setError("You must accept the Terms & Data Privacy Policy.");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
  if (
    error.message.toLowerCase().includes("email not confirmed") ||
    error.message.toLowerCase().includes("email not verified")
  ) {
    setError("Please verify your email before signing in. Check your inbox for the confirmation email.");
  } else {
    setError(error.message);
  }

  setLoading(false);
  return;
}

    const authUser = data.user;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, status")
      .eq("auth_id", authUser.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // Account was deleted (see Settings > Delete account): the auth login
    // itself still technically works, but the account is no longer active,
    // so bounce them out here rather than letting them into the app only
    // to be redirected again by RoleGuard.
    if (profile.status && profile.status !== "active") {
      await supabase.auth.signOut();
      clearRememberMe();
      setError("This account has been deleted. Contact support if you believe this is a mistake.");
      setLoading(false);
      return;
    }

    // "Remember me" persists this session (up to 30 days) so a new tab or
    // a reopened browser can restore it automatically — see src/lib/supabase.js.
    persistRememberMe(remember, data.session);

    const role = profile.role;

    await routeAfterAuth(authUser, role);

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
};

  return (
    <div className={styles.page}>
      <ThemeToggle className={styles.fixedThemeToggle} />
      <div className={styles.container}>
      {/* LEFT INTRO PANEL */}
      <div data-no-glow className={styles.leftPanel}>
        <img
    src="/logo.png"
    alt="SmartScholar Logo"
    className={styles.logo}
/>

        <h1 className={styles.brand}>SmartScholar</h1>

        <p className={styles.tagline}>
          A centralized scholarship management system designed to streamline
          applications, compliance tracking, and fund distribution.
        </p>

        <div className={styles.features}>
  <div><Icon name="check" size={14} /> Apply for scholarships online</div>
  <div><Icon name="check" size={14} /> Track application progress</div>
  <div><Icon name="check" size={14} /> Submit compliance requirements</div>
  <div><Icon name="check" size={14} /> Receive scholarship notifications</div>
  <div><Icon name="check" size={14} /> Secure document management</div>
</div>

       
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div data-no-glow className={styles.rightPanel}>
        <div className={styles.card}>
          <div className={styles.header}>
            
            <h2 className={styles.title}>Welcome</h2>
            <p className={styles.subtitle}>Login to your account</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleLogin} className={styles.form}>
            <input
  type="email"
  className={styles.input}
  placeholder="Email address"
  value={email}
  required
  onChange={(e) => setEmail(e.target.value)}
/>

            <div className={styles.passwordField}>
  <input
    type={showPassword ? "text" : "password"}
    className={styles.input}
    placeholder="Password"
    value={password}
    required
    onChange={(e) => setPassword(e.target.value)}
  />

  <button
    type="button"
    className={styles.passwordToggle}
    onClick={() => setShowPassword(!showPassword)}
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? <FaEyeSlash /> : <FaEye />}
  </button>
</div>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -4 }}>
  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
    <input
      type="checkbox"
      checked={remember}
      onChange={(e) => setRemember(e.target.checked)}
    />
    Remember me for 30 days
  </label>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={() => setShowForgot(true)}
  >
    Forgot password?
  </Button>
</div>

            {/* TERMS CHECKBOX */}
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => { setAccepted(e.target.checked); setAcceptedTerms(e.target.checked); }}
              />
              <span>
                I agree to the{" "}
                <span
                  onClick={() => setShowTerms(true)}
                  className={styles.link}
                >
                  Terms & Data Privacy Policy
                </span>
              </span>
            </label>

            <button className={styles.primaryButton} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <div className={styles.divider}>
  <span className={styles.line}></span>
  <span>OR</span>
  <span className={styles.line}></span>
</div>
            <button
  type="button"
  className={styles.googleButton}
  onClick={handleGoogleLogin}
  disabled={loading}
>
  {loading ? "Redirecting..." : "Continue with Google"}
</button>


          </form>

          <div className={styles.signup}>
            <span>Don’t have an account?</span>
            <Link to="/signup" className={styles.signupLink}>
              Create one
            </Link>
          </div>

        </div>
      </div>

      {/* TERMS MODAL */}
      {showTerms && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Terms & Data Privacy Policy</h2>

            <p>
              By using SmartScholar, you agree that your personal data
              (name, email, academic records, and uploaded documents) will be
              securely stored and processed for scholarship management purposes only.
            </p>

            <p>
              We comply with the Data Privacy Act of the Philippines (RA 10173).
              Your data will NOT be shared with unauthorized third parties.
            </p>

            <p>
              You are responsible for ensuring that uploaded documents are
              accurate and valid.
            </p>

            <button
              onClick={() => setShowTerms(false)}
              className={styles.modalButton}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Modal open={showForgot} onClose={() => setShowForgot(false)} title="Reset password" size="sm">
        <ForgotPasswordFlow
          initialEmail={email}
          onCancel={() => setShowForgot(false)}
          onSuccess={handleResetSuccess}
        />
      </Modal>
      </div>
    </div>
  );
}