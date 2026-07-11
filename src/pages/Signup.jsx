import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import styles from "@/styles/Auth.module.css";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { FaEye, FaEyeSlash } from "react-icons/fa";
export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className={styles.page}>
  <ThemeToggle className={styles.fixedThemeToggle} />
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

      {/* RIGHT PANEL */}
      <div className={styles.rightPanel}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>Create Account</h2>
            <p className={styles.subtitle}>Join our community of scholars</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

         <form
    onSubmit={handleSignup}
    className={styles.form}
>

            <input
  type="email"
  className={styles.input}
  placeholder="Email address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>

            <div className={styles.passwordField}>
    <input
        type={showPassword ? "text" : "password"}
        className={styles.input}
        placeholder="Password"
        value={password}
        minLength={6}
        required
        onChange={(e) => setPassword(e.target.value)}
    />

    <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setShowPassword(!showPassword)}
        aria-label={
            showPassword
                ? "Hide password"
                : "Show password"
        }
    >
        {showPassword
            ? <FaEyeSlash />
            : <FaEye />}
    </button>
</div>

            {/* TERMS */}
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
              {loading ? "Creating account..." : "Sign Up"}
            </button>

            <div className={styles.divider}>
  <span className={styles.line}></span>
  <span>OR</span>
  <span className={styles.line}></span>
</div>

          <button
  type="button"
  className={styles.googleButton}
  onClick={handleGoogleSignup}
>
  Continue with Google
</button>

          </form>

          <div className={styles.signup}>
            <span>Already have an account?</span>
            <Link to="/Login" className={styles.signupLink}>
              Login
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
