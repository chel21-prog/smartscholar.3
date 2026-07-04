import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    
    e.preventDefault();

    if (!accepted) {
      setError("You must accept the Terms & Data Privacy Policy.");
      return;
    }

    setLoading(true);
    setError("");

    // 1. Create auth user
    const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const authUser = data.user;

    // 2. Insert into users table
    const { data: userRow, error: dbError } = await supabase
      .from("users")
      .insert([
        {
  auth_id: authUser.id,
  email,
  first_name: null,
  last_name: null,
  role: "Student",
  status: "active",
},
      ])
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    // 3. Insert into students table
    const { error: studentError } = await supabase.from("students").insert([
      {
        user_id: userRow.user_id,
        course: null,
        year_level: null,
        gender: null,
        ethnicity: null,
        contact_number: null,
        school_id: `TEMP-${Date.now()}`,
        status: "Enrolled",
      },
    ]);

    if (studentError) {
      setError(studentError.message);
      setLoading(false);
      return;
    }

    setLoading(false);

alert(
  "Your account has been created.\n\nPlease check your email and verify your account before logging in."
);

navigate("/Login");
  };

  const handleGoogleSignup = async () => {
  setLoading(true);
  setError("");

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    setError(error.message);
    setLoading(false);
  }
};

  return (
    <div style={styles.wrapper}>

      {/* LEFT PANEL */}
      <div style={styles.leftPanel}>
        <img src="/logo.png" style={styles.bigLogo} />

        <h1 style={styles.brand}>SmartScholar</h1>

        <p style={styles.tagline}>
          A centralized scholarship management system designed to streamline
          applications, compliance tracking, and fund distribution.
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div style={styles.rightPanel}>
        <div style={styles.card}>

          <div style={styles.header}>
            <h2 style={styles.title}>Create Account</h2>
            <p style={styles.subtitle}>Sign up as a student</p>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSignup} style={styles.form}>

            <input
  type="email"
  style={styles.input}
  placeholder="Email address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>

            <input
  type="password"
  style={styles.input}
  placeholder="Password"
  value={password}
  minLength={6}
  required
  onChange={(e) => setPassword(e.target.value)}
/>

            {/* TERMS */}
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <span
                  onClick={() => setShowTerms(true)}
                  style={styles.link}
                >
                  Terms & Data Privacy Policy
                </span>
              </span>
            </label>

 <button style={styles.button} disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </button>

            <div style={styles.divider}>
  <span style={styles.line}></span>
  <span>OR</span>
  <span style={styles.line}></span>
</div>

          <button
  type="button"
  style={styles.googleButton}
  onClick={handleGoogleSignup}
>
  Continue with Google
</button>

          </form>

          <div style={styles.signup}>
            <span>Already have an account?</span>
            <Link to="/Login" style={styles.signupLink}>
              Login
            </Link>
          </div>

        </div>
      </div>

      {/* TERMS MODAL */}
      {showTerms && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Terms & Data Privacy Policy</h2>

            <p>
              By creating an account, you agree that your personal data
              (name, email, academic records, and uploaded files) will be
              stored securely and used only for scholarship processing.
            </p>

            <p>
              We comply with the Data Privacy Act of the Philippines (RA 10173).
              Your information will not be shared without authorization.
            </p>

            <p>
              You are responsible for ensuring all submitted information is accurate.
            </p>

            <button
              onClick={() => setShowTerms(false)}
              style={styles.modalBtn}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* STYLES */
const styles = {

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
};