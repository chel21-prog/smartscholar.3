import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import styles from "./Settings.module.css";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

export default function Settings() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Inline error/success messages instead of alert() dialogs
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    getRole();

    // Bug fix: was navigating to "/login" (lowercase), but the only
    // registered route is "/Login" (capital L) in App.jsx. Fixed here
    // and in all other navigate calls below.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/Login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/Login");
      return;
    }

    setEmail(user.email);

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    setRole(data?.role);
  };

  const logout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    navigate("/Login");
  };

  const changePassword = async () => {
    setPwError("");
    setPwSuccess(false);

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPwError("Please fill in both password fields.");
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      setPwError(
        "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match. Please re-enter.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPwError(error.message);
        return;
      }

      setPwSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setPwError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const passwordValid = PASSWORD_REGEX.test(newPassword);
  const formValid =
    newPassword && confirmPassword && passwordValid && newPassword === confirmPassword;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Settings</h1>
        <p className={styles.subtitle}>
          Manage your account, security, and session.
        </p>
      </div>

      {/* ACCOUNT INFO */}
      <Card>
        <CardHeader title="Account information" />

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Email</span>
          <span className={styles.infoValue}>{email || "—"}</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Role</span>
          <Badge tone="info">{role || "—"}</Badge>
        </div>
      </Card>

      {/* SECURITY */}
      <Card>
        <CardHeader title="Security" subtitle="Change your password." />

        <div className={styles.passwordSection}>
          <Field label="New password">
            <div className={styles.passwordRow}>
              <Input
                type={showNew ? "text" : "password"}
                placeholder="Enter a new password"
                value={newPassword}
                disabled={saving}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwError("");
                  setPwSuccess(false);
                }}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                disabled={saving}
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <Field label="Confirm password">
            <div className={styles.passwordRow}>
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                disabled={saving}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPwError("");
                  setPwSuccess(false);
                }}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                disabled={saving}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </Field>

          <div className={styles.tipBox}>
            <strong>Password requirements:</strong>
            <ul>
              <li>At least 6 characters</li>
              <li>One uppercase letter (A–Z)</li>
              <li>One lowercase letter (a–z)</li>
              <li>One number (0–9)</li>
            </ul>
          </div>

          {pwError && (
            <p className={styles.pwError} role="alert">
              {pwError}
            </p>
          )}

          {pwSuccess && (
            <p className={styles.pwSuccess} role="status">
              ✓ Password updated successfully.
            </p>
          )}

          <Button
            onClick={changePassword}
            disabled={saving || !formValid}
            loading={saving}
          >
            Update password
          </Button>
        </div>
      </Card>

      {/* SESSION */}
      <Card>
        <CardHeader title="Session" />

        <p className={styles.logoutHint}>
          Sign out of your current session. You'll need to log in again to
          access your account.
        </p>

        <Button variant="danger" onClick={logout} loading={loggingOut}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
