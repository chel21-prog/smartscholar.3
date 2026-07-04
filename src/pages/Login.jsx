import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import styles from "@/styles/Auth.module.css";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showForgot,   setShowForgot]   = useState(false);
const [resetEmail,   setResetEmail]   = useState("");
const [resetSending, setResetSending] = useState(false);
const [resetSent,    setResetSent]    = useState(false);
const [resetError,   setResetError]   = useState("");
  const navigate = useNavigate();
  

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
      .select("role")
      .eq("auth_id", authUser.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const role = profile.role;

    if (role === "Student") {
  // USERS table
  const { data: userData } = await supabase
    .from("users")
    .select(`
      user_id,
      first_name,
      middle_name,
      last_name
    `)
    .eq("auth_id",  authUser.id)
    .single();

  // STUDENTS table
  const { data: studentData } = await supabase
    .from("students")
    .select(`
      school_id,
      course,
      year_level,
      gender,
      ethnicity,
      contact_number
    `)
    .eq("user_id", userData.user_id)
    .single();

  const profileComplete =
    userData?.first_name &&
    userData?.middle_name &&
    userData?.last_name &&
    studentData?.school_id &&
    studentData?.course &&
    studentData?.year_level &&
    studentData?.gender &&
    studentData?.ethnicity &&
    studentData?.contact_number;

  if (profileComplete) {
    navigate("/student/dashboard");
  } else {
    navigate("/student/profile");
  }
}
    else if (role === "Coordinator") navigate("/coordinator/dashboard");
    else if (role === "Cashier") navigate("/cashier/dashboard");
    else navigate("/");

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
const sendReset = async (e) => {
  e.preventDefault();
  setResetError("");
  setResetSending(true);

  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  setResetSending(false);

  if (error) {
    setResetError(error.message);
    return;
  }

  setResetSent(true);
};

  return (
    <div className={styles.page}>
      <div className={styles.container}>
      {/* LEFT INTRO PANEL */}
      <div className={styles.leftPanel}>
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
  <div>✓ Apply for scholarships online</div>
  <div>✓ Track application progress</div>
  <div>✓ Submit compliance requirements</div>
  <div>✓ Receive scholarship notifications</div>
  <div>✓ Secure document management</div>
</div>

       
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div className={styles.rightPanel}>
        <div className={styles.card}>
          <div className={styles.cardTop}>

    <ThemeToggle />

</div>
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
<div style={{ textAlign: "right", marginTop: -4 }}>
  <button
    type="button"
    style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
    onClick={() => {
      setShowForgot(true);
      setResetEmail(email);
      setResetSent(false);
      setResetError("");
    }}
  >
    Forgot password?
  </button>
</div>

            {/* TERMS CHECKBOX */}
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
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

      {showForgot && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
    <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Reset password</h2>

      {resetSent ? (
        <>
          <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", color: "#166534", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            ✓ Check your email — we sent a reset link to <strong>{resetEmail}</strong>.
          </div>
          <button onClick={() => setShowForgot(false)}
            style={{ padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Close
          </button>
        </>
      ) : (
        <form onSubmit={sendReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Enter your account email and we'll send you a link to reset your password.
          </p>
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            style={{ padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
          />
          {resetError && (
            <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>
              {resetError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForgot(false)}
              style={{ padding: "10px 16px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" disabled={resetSending}
              style={{ padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {resetSending ? "Sending…" : "Send reset link"}
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
)}
      </div>
    </div>
  );
}