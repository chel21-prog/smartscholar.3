import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { signOutCurrentAccount } from "@/lib/authSync";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/EyeIcons";
import { useToast } from "@/context/ToastContext";
import { getReportSecurity, saveReportSecurity, generateStrongPassword } from "@/lib/reportSecurity";
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
  const [currentPassword, setCurrentPassword] = useState("");
const [showCurrent, setShowCurrent] = useState(false);

  // ── report PDF protection (Coordinator only) ────────────
  const toast = useToast();
  const [reportSec, setReportSec] = useState(null); // row from DB, or null if unset/unavailable
  const [reportSecLoading, setReportSecLoading] = useState(true);
  const [reportSecSaving, setReportSecSaving] = useState(false);
  const [showReportPassword, setShowReportPassword] = useState(false);
  const [customPassword, setCustomPassword] = useState("");

  useEffect(() => {
    getReportSecurity()
      .then((row) => { setReportSec(row); setCustomPassword(row?.password || ""); })
      .finally(() => setReportSecLoading(false));
  }, []);

  const persistReportSecurity = async (patch) => {
    setReportSecSaving(true);
    try {
      const saved = await saveReportSecurity({
        id: reportSec?.id,
        enabled: true, // kept for schema compat — actual protect/skip choice now lives in the report modal
        password: patch.password ?? reportSec?.password ?? "",
        updatedBy: email,
      });
      setReportSec(saved);
      setCustomPassword(saved.password || "");
      return saved;
    } catch (err) {
      toast.error("Couldn't save report protection settings: " + err.message);
      return null;
    } finally {
      setReportSecSaving(false);
    }
  };

  const regeneratePassword = async () => {
    const pwd = generateStrongPassword();
    const saved = await persistReportSecurity({ password: pwd });
    if (saved) {
      // Deliberately NOT auto-revealed — stays masked until the coordinator
      // clicks the eye icon themselves, same as any other password field.
      toast.success("New password generated. Click the eye icon to view it, then share it with report recipients — the old one no longer works.");
    }
  };

  const saveCustomPassword = async () => {
    if (!customPassword.trim() || customPassword.trim().length < 6) {
      toast.error("Password should be at least 6 characters.");
      return;
    }
    const saved = await persistReportSecurity({ password: customPassword.trim() });
    if (saved) toast.success("Report PDF password updated.");
  };

  const copyReportPassword = async () => {
    try {
      await navigator.clipboard.writeText(reportSec?.password || "");
      toast.success("Password copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — select and copy it manually.");
    }
  };

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
    await signOutCurrentAccount();
    navigate("/Login");
  };

  const changePassword = async () => {
  setPwError("");
  setPwSuccess(false);

  if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
    setPwError("Please fill in all three fields.");
    return;
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    setPwError("Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number.");
    return;
  }

  if (newPassword !== confirmPassword) {
    setPwError("New passwords don't match.");
    return;
  }

  if (currentPassword === newPassword) {
    setPwError("New password must be different from your current password.");
    return;
  }

  setSaving(true);

  // Re-authenticate with current password first — this verifies they
  // actually know it without needing the Supabase setting enabled.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (signInError) {
    setPwError("Current password is incorrect.");
    setSaving(false);
    return;
  }

  // Current password confirmed — now update to the new one.
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    setPwError(error.message);
    setSaving(false);
    return;
  }

  setPwSuccess(true);
  setCurrentPassword("");
  setNewPassword("");
  setConfirmPassword("");
  setSaving(false);
};

  const passwordValid = PASSWORD_REGEX.test(newPassword);
  const formValid =
  currentPassword &&
  newPassword &&
  confirmPassword &&
  passwordValid &&
  newPassword === confirmPassword &&
  currentPassword !== newPassword;

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
          <Field label="Current password">
  <div className={styles.passwordField}>
    <Input
      type={showCurrent ? "text" : "password"}
      placeholder="Enter your current password"
      value={currentPassword}
      disabled={saving}
      className={styles.passwordInput}
      onChange={(e) => {
        setCurrentPassword(e.target.value);
        setPwError("");
        setPwSuccess(false);
      }}
    />
    <button
      type="button"
      className={styles.eyeBtn}
      disabled={saving}
      onClick={() => setShowCurrent((v) => !v)}
      aria-label={showCurrent ? "Hide password" : "Show password"}
    >
      {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  </div>
</Field>
          <Field label="New password">
            <div className={styles.passwordField}>
              <Input
                type={showNew ? "text" : "password"}
                placeholder="Enter a new password"
                value={newPassword}
                disabled={saving}
                className={styles.passwordInput}
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
                {showNew ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </Field>

          <Field label="Confirm password">
            <div className={styles.passwordField}>
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                disabled={saving}
                className={styles.passwordInput}
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
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
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

      {/* REPORT PDF PASSWORD — Coordinator only */}
      {role === "Coordinator" && (
        <Card>
          <CardHeader
            title="Report PDF password"
            subtitle="Set the password used to protect exported PDF reports. When generating a report, there's a toggle to secure that export with this password — it's not applied automatically."
          />

          {reportSecLoading ? (
            <p className={styles.logoutHint}>Loading…</p>
          ) : !reportSec?.password ? (
            <div className={styles.passwordSection}>
              <p className={styles.logoutHint}>No password has been set yet.</p>
              <Button onClick={regeneratePassword} loading={reportSecSaving}>
                Generate password
              </Button>
            </div>
          ) : (
            <div className={styles.passwordSection}>
              <Field label="Current export password">
                <div className={styles.passwordField}>
                  <Input
                    type={showReportPassword ? "text" : "password"}
                    value={reportSec?.password || ""}
                    readOnly
                    className={styles.passwordInput}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowReportPassword((v) => !v)}
                    aria-label={showReportPassword ? "Hide password" : "Show password"}
                  >
                    {showReportPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={copyReportPassword} disabled={reportSecSaving}>
                  Copy password
                </Button>
                <Button variant="secondary" onClick={regeneratePassword} loading={reportSecSaving}>
                  Generate new password
                </Button>
              </div>

              <Field label="Or set a custom password">
                <div className={styles.passwordField}>
                  <Input
                    type={showReportPassword ? "text" : "password"}
                    placeholder="Type a password to use instead"
                    value={customPassword}
                    disabled={reportSecSaving}
                    className={styles.passwordInput}
                    onChange={(e) => setCustomPassword(e.target.value)}
                  />
                </div>
              </Field>
              <Button
                variant="secondary"
                onClick={saveCustomPassword}
                loading={reportSecSaving}
                disabled={!customPassword.trim() || customPassword.trim() === reportSec?.password}
              >
                Save custom password
              </Button>

              <div className={styles.tipBox}>
                <strong>How this works:</strong>
                <ul>
                  <li>This password isn't applied automatically — check "Secure this report with a password" in the Generate Report modal to use it for a given export.</li>
                  <li>Regenerating or changing it immediately invalidates the old password — reports already sent out still open with whichever password was active when they were generated.</li>
                  <li>Share the password separately from the report itself (e.g. a different chat message or channel), not in the same email as the PDF.</li>
                </ul>
              </div>
            </div>
          )}
        </Card>
      )}

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
