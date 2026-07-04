import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import styles from "@/styles/Auth.module.css";
import ThemeToggle from "@/components/ui/ThemeToggle";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [theme, setTheme] = useState(
  localStorage.getItem("theme") || "light"
);
  const navigate = useNavigate();
  
  useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);

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

            <input
  type="password"
  className={styles.input}
  placeholder="Password"
  value={password}
  required
  onChange={(e) => setPassword(e.target.value)}
/>

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
      </div>
    </div>
  );
}

/* STYLES */
const oldstyles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "Arial",
  },

  leftPanel: {
    flex: 1,
    background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
    color: "white",
    padding: 60,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  bigLogo: {
    width: 300,
    marginBottom: 20,
  },

  brand: {
    fontSize: 40,
    fontWeight: "bold",
    color: "white",
  },

  tagline: {
    marginTop: 10,
    fontSize: 14,
    opacity: 0.85,
    maxWidth: 400,
  },

  list: {
    marginTop: 20,
    fontSize: 14,
    lineHeight: 2,
  },

  rightPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 380,
    background: "#fff",
    padding: 30,
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
  },

  header: {
    textAlign: "center",
    marginBottom: 20,
  },

  logo: {
    width: 60,
    marginBottom: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: 700,
  },

  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
  },

  checkbox: {
    fontSize: 12,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  link: {
    color: "#2563eb",
    cursor: "pointer",
    textDecoration: "underline",
  },

  button: {
    padding: 12,
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    marginBottom: 10,
  },

  signup: {
    marginTop: 15,
    textAlign: "center",
    fontSize: 12,
  },

  signupLink: {
    color: "#2563eb",
    marginLeft: 5,
    textDecoration: "none",
    fontWeight: 600,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modal: {
    background: "white",
    padding: 25,
    borderRadius: 12,
    width: 400,
  },

  modalBtn: {
    marginTop: 15,
    padding: 10,
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
  },
  googleButton: {
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#475c6c",
  cursor: "pointer",
  fontWeight: 600,
},

divider: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "5px 0",
},

line: {
  flex: 1,
  height: 1,
  background: "#ddd",
},
};