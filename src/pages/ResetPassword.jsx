import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { signOutCurrentAccount } from "../lib/authSync";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!PASSWORD_REGEX.test(password)) {
      setError("Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setSuccess(true);
    await signOutCurrentAccount();
    setTimeout(() => navigate("/Login"), 2500);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <img src="/logo.png" style={styles.logo} alt="SmartScholar" />
        <h2 style={styles.title}>Set new password</h2>

        {!ready && !success && (
          <p style={styles.hint}>Waiting for your reset link to be verified…</p>
        )}

        {success && (
          <div style={styles.successBox}>
            ✓ Password updated! Redirecting you to login…
          </div>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>New password</label>
              <div style={styles.pwRow}>
                <input style={styles.input} type={showPw ? "text" : "password"}
                  placeholder="New password" value={password} required autoFocus
                  onChange={e => setPassword(e.target.value)} />
                <button type="button" style={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.label}>Confirm password</label>
              <input style={styles.input} type={showPw ? "text" : "password"}
                placeholder="Repeat new password" value={confirm} required
                onChange={e => setConfirm(e.target.value)} />
            </div>
            <p style={styles.hint}>At least 6 characters · one uppercase · one lowercase · one number</p>
            {error && <div style={styles.errorBox}>{error}</div>}
            <button style={styles.btn} disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--page-bg)", padding: 20, fontFamily: "var(--font-sans)" },
  card: { width: "100%", maxWidth: 400, background: "var(--surface)", borderRadius: "var(--radius-xl)", padding: 32, boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", gap: 16, border: "1px solid var(--border)" },
  logo: { width: 80, alignSelf: "center" },
  title: { margin: 0, fontSize: 22, fontWeight: 700, textAlign: "center", color: "var(--text-primary)" },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" },
  pwRow: { display: "flex", gap: 8 },
  input: { flex: 1, height: 44, padding: "0 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", fontSize: 14, outline: "none", boxSizing: "border-box", background: "var(--surface)", color: "var(--text-primary)" },
  eyeBtn: { padding: "0 14px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", background: "var(--surface)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", whiteSpace: "nowrap" },
  hint: { margin: 0, fontSize: 12, color: "var(--text-secondary)" },
  errorBox: { background: "var(--danger-100)", border: "1px solid var(--danger-600)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--danger-700)", fontSize: 13, fontWeight: 600 },
  successBox: { background: "var(--success-100)", border: "1px solid var(--teal-500)", borderRadius: "var(--radius-md)", padding: "12px 16px", color: "var(--success-700)", fontSize: 14, fontWeight: 600, textAlign: "center" },
  btn: { height: 44, background: "var(--navy-700)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontWeight: 700, fontSize: 15, cursor: "pointer" },
};