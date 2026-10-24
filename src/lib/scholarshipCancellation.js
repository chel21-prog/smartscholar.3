/**
 * Ending a scholarship early — by the coordinator (revoke) or at the student's
 * request (cancellation). Both use the termination the app already understands:
 * grantees.status "Inactive" + verification_result "Ineligible" + termination_reason.
 * That is exactly what the payout schedule, the cashier pages and the reports
 * already read, so payouts stop and the reason shows everywhere with no extra work.
 */

export const REVOKED_LABEL = "Revoked by the coordinator";
export const CANCELLED_LABEL = "Cancelled at the student's request";

export const terminationText = (kind, reason) =>
  `${kind === "revoke" ? REVOKED_LABEL : CANCELLED_LABEL}: ${String(reason).trim()}`;

export const revokeMessage = (scholarship, reason) =>
  `Your ${scholarship} scholarship has been revoked by the scholarship office.\n\n` +
  `Reason: ${String(reason || "").trim() || "(no reason given)"}\n\n` +
  `Payouts for this scholarship have stopped. If you think this is a mistake, please contact the scholarship office.`;

export const cancellationApprovedMessage = (scholarship, remarks) =>
  `Your request to cancel your ${scholarship} scholarship was approved, so it has now ended and payouts have stopped.` +
  (remarks?.trim() ? `\n\nNote from the coordinator: ${remarks.trim()}` : "");

export const cancellationDeclinedMessage = (scholarship, remarks) =>
  `Your request to cancel your ${scholarship} scholarship was not approved, so it stays active.` +
  (remarks?.trim() ? `\n\nReason: ${remarks.trim()}` : "") +
  `\n\nYou can send a new request or contact the scholarship office if you have questions.`;

const cleanTerm = (v) => (v && v !== "N/A" ? v : null);

/**
 * Marks a grantee row as ended and logs it in the verification history.
 * grantee: { grantee_id, academic_year?, semester? }
 */
export async function endScholarship(supabase, { grantee, reasonText, verifiedBy }) {
  const { data, error } = await supabase
    .from("grantees")
    .update({
      status: "Inactive",
      verification_result: "Ineligible",
      termination_reason: reasonText,
      verification_remarks: reasonText,
      last_verified_at: new Date().toISOString(),
      verified_by: verifiedBy ?? null,
    })
    .eq("grantee_id", grantee.grantee_id)
    .select("grantee_id");

  if (error) return { error };
  // supabase doesn't error when a policy silently blocks the write — no row back means nothing changed
  if (!data || data.length === 0) {
    return { error: { message: "Nothing was updated. You may not have permission to change this scholarship." } };
  }

  // history is nice-to-have; never fail the revoke because of it
  await supabase.from("grantee_verifications").insert({
    grantee_id: grantee.grantee_id,
    academic_year: cleanTerm(grantee.academic_year),
    semester: cleanTerm(grantee.semester),
    verification_status: "Ineligible",
    remarks: reasonText,
    verified_by: verifiedBy ?? null,
  });

  return { error: null };
}

/**
 * Sends the student a notification. Tries a dedicated "Scholarship" type (the
 * bell routes it to My Applications); if the notifications table only accepts
 * its older types, falls back to "Other" so it still goes through.
 */
export async function notifyStudent(supabase, userId, title, message) {
  if (!userId || !message?.trim()) return false;
  const base = { user_id: userId, title, message: message.trim(), is_read: false };
  let { error } = await supabase.from("notifications").insert({ ...base, notification_type: "Scholarship" });
  if (error) {
    ({ error } = await supabase.from("notifications").insert({ ...base, notification_type: "Other" }));
  }
  return !error;
}
