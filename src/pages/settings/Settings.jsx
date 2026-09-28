import { useState, useEffect } from "react";
import { supabase, clearRememberMe } from "@/lib/supabase";
import { signOutCurrentAccount } from "@/lib/authSync";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import LegalNotice from "@/components/ui/LegalNotice";
import ForgotPasswordFlow from "@/components/ui/ForgotPasswordFlow";
import { EyeIcon, EyeOffIcon } from "@/components/ui/EyeIcons";
import { useToast } from "@/context/ToastContext";
import { getReportSecurity, saveReportSecurity, generateStrongPassword } from "@/lib/reportSecurity";
import { clearAllCached } from "@/lib/dataCache";
import styles from "./Settings.module.css";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

const TILE_ICONS = {
  security: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  ),
  report: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3.5v5c0 5-3.4 8.5-8 9.5-4.6-1-8-4.5-8-9.5v-5L12 3z" />
    </svg>
  ),
  legal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l4 4v14H5V3z" /><path d="M9 9h6M9 13h6M9 17h3" />
    </svg>
  ),
  cache: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0115-6.7M21 12a9 9 0 01-15 6.7" />
      <path d="M21 3v5h-5M3 21v-5h5" />
    </svg>
  ),
  delete: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
};

function SettingsTile({ tone, icon, title, description, onClick }) {
  return (
    <button type="button" className={`${styles.tile} ${styles["tone-" + tone]}`} onClick={onClick}>
      <span className={styles.tileIcon}>{icon}</span>
      <span className={styles.tileText}>
        <span className={styles.tileTitle}>{title}</span>
        <span className={styles.tileDesc}>{description}</span>
      </span>
      <svg className={styles.tileChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Inline error/success messages instead of alert() dialogs
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
const [showCurrent, setShowCurrent] = useState(false);

  // ── Forgot current password, from inside Settings itself ────────────
  // (the actual request/verify flow now lives in the shared
  // ForgotPasswordFlow component, opened as its own modal below)

  // Which settings feature's popup is open — null, "security", "report", or "legal"
  const [openModal, setOpenModal] = useState(null);
  const closeModal = () => setOpenModal(null);
  const [clearingCache, setClearingCache] = useState(false);

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

  const clearCache = () => {
    setClearingCache(true);
    clearAllCached();
    toast.success("Cache cleared. Reloading…");
    // Give the toast a moment to render before the reload wipes the page.
    setTimeout(() => window.location.reload(), 600);
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

  // ── Delete account ──────────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePw, setShowDeletePw] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = async () => {
    setDeleteError("");

    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteError('Please type "DELETE" to confirm.');
      return;
    }
    if (!deletePassword.trim()) {
      setDeleteError("Please enter your password to confirm it's really you.");
      return;
    }

    setDeleting(true);

    // Re-authenticate first, same pattern as changePassword above — this
    // confirms whoever is at the keyboard actually knows the account
    // password before we do anything irreversible.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: deletePassword,
    });

    if (signInError) {
      setDeleteError("Password is incorrect.");
      setDeleting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Soft-delete: flip the account to inactive rather than removing the
    // `users` row outright. Scholarship applications, grantee records,
    // compliance submissions and payout/liquidation history all reference
    // this row by user_id — deleting it would either be rejected by the
    // database or, worse, silently orphan or cascade-delete records that
    // the institution has to keep regardless of what happens to the login.
    // RoleGuard already treats any non-"active" status as logged out, so
    // this one flag is enough to fully and immediately block the account.
    const { error: updateError } = await supabase
      .from("users")
      .update({ status: "deleted" })
      .eq("auth_id", user.id);

    if (updateError) {
      setDeleteError("Couldn't delete account: " + updateError.message);
      setDeleting(false);
      return;
    }

    clearRememberMe();
    await signOutCurrentAccount();
    window.location.href = "/Login";
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
    <div className={`page-shell ${styles.page}`}>
      <div className={`page-header ${styles.header}`}>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Manage your account and security.
        </p>
      </div>

      {/* ACCOUNT INFO — always visible, not a popup */}
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

      <div className={styles.tileGrid}>
        <SettingsTile
          tone="teal"
          icon={TILE_ICONS.security}
          title="Security"
          description="Change your password"
          onClick={() => setOpenModal("security")}
        />
        {role === "Coordinator" && (
          <SettingsTile
            tone="gold"
            icon={TILE_ICONS.report}
            title="Report PDF password"
            description="Protect exported reports"
            onClick={() => setOpenModal("report")}
          />
        )}
        <SettingsTile
          tone="navy"
          icon={TILE_ICONS.legal}
          title="Legal"
          description="Terms, data privacy & cookies"
          onClick={() => setOpenModal("legal")}
        />
        <SettingsTile
          tone="danger"
          icon={TILE_ICONS.cache}
          title="Clear cache"
          description="Fix stale or outdated data"
          onClick={() => setOpenModal("cache")}
        />
        <SettingsTile
          tone="danger"
          icon={TILE_ICONS.delete}
          title="Delete account"
          description="Remove your login access"
          onClick={() => setOpenModal("delete")}
        />
      </div>

      {/* SECURITY */}
      <Modal
        open={openModal === "security"}
        onClose={closeModal}
        title="Security"
        size="md"
      >
        <p className={styles.modalSubtitle}>Change your password.</p>

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

  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={() => { closeModal(); setOpenModal("forgotPassword"); }}
    className={styles.forgotBtn}
  >
    Forgot your current password?
  </Button>
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
      </Modal>

      {/* REPORT PDF PASSWORD — Coordinator only */}
      {role === "Coordinator" && (
        <Modal open={openModal === "report"} onClose={closeModal} title="Report PDF password" size="md">
          <p className={styles.modalSubtitle}>
            Set the password used to protect exported PDF reports. When generating a report, there's a toggle to secure that export with this password — it's not applied automatically.
          </p>

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
        </Modal>
      )}

      {/* LEGAL — Terms, Data Privacy Policy & cookie/local storage notice */}
      <Modal open={openModal === "legal"} onClose={closeModal} title="Legal" size="md">
        <LegalNotice />
      </Modal>

      {/* CLEAR CACHE — flushes the in-memory, per-tab list/dashboard cache */}
      <Modal open={openModal === "cache"} onClose={closeModal} title="Clear cache" size="md">
        <p className={styles.modalSubtitle}>
          SmartScholar keeps a temporary copy of lists and dashboards you've
          visited so pages load instantly. If something looks out of date,
          clearing it forces a fresh reload from the server.
        </p>
        <Button variant="danger" onClick={clearCache} loading={clearingCache}>
          Clear cache now
        </Button>
      </Modal>

      {/* FORGOT CURRENT PASSWORD — email-code flow, shared with Login.jsx */}
      <Modal open={openModal === "forgotPassword"} onClose={closeModal} title="Reset password" size="sm">
        <ForgotPasswordFlow
          lockedEmail={email}
          onCancel={closeModal}
          onSuccess={() => {
            closeModal();
            toast.success("Password updated.");
          }}
        />
      </Modal>

      {/* DELETE ACCOUNT */}
      <Modal
        open={openModal === "delete"}
        onClose={() => {
          closeModal();
          setDeletePassword("");
          setDeleteConfirmText("");
          setDeleteError("");
        }}
        title="Delete account"
        size="md"
      >
        <p className={styles.modalSubtitle}>
          This removes your SmartScholar login. It does not erase your history.
        </p>

        <div className={styles.tipBox}>
          <strong>What happens:</strong>
          <ul>
            <li>You'll be signed out immediately and won't be able to log back in with this account.</li>
            <li>Your profile is deactivated — it won't be usable or visible to you again.</li>
            <li>
              Your scholarship applications, grantee records, compliance submissions,
              and payout/liquidation history are KEPT, since they're
              part of the institution's scholarship and financial records and can't
              be removed just because the account is deleted.
            </li>
          </ul>
        </div>

        {deleteError && (
          <p className={styles.pwError} role="alert">
            {deleteError}
          </p>
        )}

        <div className={styles.passwordSection}>
          <Field label="Confirm your password">
            <div className={styles.passwordField}>
              <Input
                type={showDeletePw ? "text" : "password"}
                placeholder="Enter your current password"
                value={deletePassword}
                disabled={deleting}
                className={styles.passwordInput}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError("");
                }}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                disabled={deleting}
                onClick={() => setShowDeletePw((v) => !v)}
                aria-label={showDeletePw ? "Hide password" : "Show password"}
              >
                {showDeletePw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </Field>

          <Field label='Type "DELETE" to confirm'>
            <Input
              placeholder="DELETE"
              value={deleteConfirmText}
              disabled={deleting}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                setDeleteError("");
              }}
            />
          </Field>

          <Button
            variant="danger"
            onClick={handleDeleteAccount}
            loading={deleting}
            disabled={
              deleting ||
              !deletePassword.trim() ||
              deleteConfirmText.trim().toUpperCase() !== "DELETE"
            }
          >
            Permanently delete my account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
