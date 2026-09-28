import { supabase } from "./supabase";

/**
 * Email-code password reset — replaces the old "click a link in your
 * email" flow. Supabase's resetPasswordForEmail() is the same call either
 * way; whether the email contains a clickable link, a 6-digit code, or
 * both is controlled entirely by the "Reset Password" email template in
 * the Supabase dashboard (Authentication -> Email Templates). For a code
 * to actually show up in the inbox, that template needs to include
 * {{ .Token }} somewhere in its body — otherwise Supabase only sends the
 * link and there's nothing for the user to type in here.
 */
export async function requestResetCode(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error };
}

/**
 * Verifies the 6-digit code against the email it was sent to, and — if
 * that succeeds — immediately sets the new password on the resulting
 * (freshly authenticated) session. Returns the new session on success so
 * the caller can decide what "already logged in" means for that screen
 * (redirect into the app from Login, or just close the modal from
 * Settings since they were already logged in).
 */
export async function verifyResetCode({ email, code, newPassword }) {
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });

  if (verifyError) {
    return { error: verifyError.message || "That code is incorrect or has expired." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null, session: data.session };
}
