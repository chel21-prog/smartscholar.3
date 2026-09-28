import { useState } from "react";
import Button from "@/components/ui/Button";
import { requestResetCode, verifyResetCode } from "@/lib/passwordReset";
import { PASSWORD_REGEX, PASSWORD_HINT } from "@/lib/passwordPolicy";
import styles from "./ForgotPasswordFlow.module.css";

/**
 * Content-only — the caller wraps this in its own <Modal>, the same way
 * LegalNotice.jsx works. Two steps:
 *   "email" — ask for the address, request a code
 *   "code"  — enter the code + a new password, verify + set it
 * On success, onSuccess(session) fires immediately (no local "done"
 * screen) — the caller decides what "already logged in again" means
 * here: redirect into the app from Login, or just close the modal and
 * toast from Settings, since that user was already logged in.
 */
export default function ForgotPasswordFlow({ initialEmail = "", lockedEmail = "", onSuccess, onCancel }) {
  const [step, setStep] = useState("email");
  // lockedEmail: when the person is already signed in (Settings), the
  // code can only go to the address on their own account — it's shown
  // read-only and every request/verify call uses it, whatever the input says.
  const [email, setEmail] = useState(lockedEmail || initialEmail);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const { error: reqError } = await requestResetCode(lockedEmail || email);
    setSending(false);

    if (reqError) {
      setError(reqError.message);
      return;
    }
    setStep("code");
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    if (!code.trim()) {
      setError("Enter the code we emailed you.");
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError(PASSWORD_HINT);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setVerifying(true);
    const { error: verifyError, session } = await verifyResetCode({
      email: lockedEmail || email,
      code: code.trim(),
      newPassword,
    });
    setVerifying(false);

    if (verifyError) {
      setError(verifyError);
      return;
    }
    onSuccess?.(session);
  };

  if (step === "email") {
    return (
      <form onSubmit={handleRequestCode} className={styles.form}>
        <p className={styles.hint}>
          Enter your account email and we'll send you a 6-digit code to reset your password.
        </p>
        <input
          type="email"
          required
          autoFocus
          placeholder="your@email.com"
          value={lockedEmail || email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!lockedEmail}
          className={styles.input}
        />
        {lockedEmail && (
          <p className={styles.hintSmall}>
            Codes can only be sent to the email on your account.
          </p>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={sending}>
            Send code
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className={styles.form}>
      <p className={styles.hint}>
        Enter the code sent to <strong>{lockedEmail || email}</strong>, plus a new password.
      </p>
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        required
        placeholder="6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={styles.input}
      />
      <input
        type="password"
        required
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className={styles.input}
      />
      <input
        type="password"
        required
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className={styles.input}
      />
      <p className={styles.hintSmall}>{PASSWORD_HINT}</p>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        {!lockedEmail && (
          <Button type="button" variant="ghost" onClick={() => { setStep("email"); setError(""); }}>
            Use a different email
          </Button>
        )}
        <Button type="submit" variant="primary" loading={verifying}>
          Reset password
        </Button>
      </div>
    </form>
  );
}
