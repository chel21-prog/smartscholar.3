/**
 * Scholarship slot limits.
 *
 * A slot is "occupied" by every grantees row with status "Active". When the
 * number of active grantees reaches scholarships.slots:
 *   - students can no longer apply (dashboard + submit check)
 *   - the coordinator can't approve more applications
 *   - every application still Pending is cancelled automatically and the
 *     student is told why (closePendingIfFull)
 * Revoking / ending a scholarship frees the slot, so applying opens again.
 *
 * slots <= 0 (or empty) means "no limit set".
 */
import { notifyStudent } from "@/lib/scholarshipCancellation";

export const hasLimit = (scholarship) => Number(scholarship?.slots) > 0;

export const isFull = (scholarship, occupied = 0) =>
  hasLimit(scholarship) && Number(occupied) >= Number(scholarship.slots);

export const slotsFullReason = (scholarship) =>
  `All ${Number(scholarship?.slots)} slot${Number(scholarship?.slots) === 1 ? "" : "s"} for this scholarship are filled. ` +
  `It opens again if a slot is freed up (for example when a scholarship is revoked).`;

export const slotsFullMessage = (scholarshipName, slots) =>
  `Your application for the ${scholarshipName} scholarship was cancelled automatically.\n\n` +
  `Reason: all ${slots} available slot${Number(slots) === 1 ? " has" : "s have"} now been filled, so the scholarship is no longer accepting applications.\n\n` +
  `This is not a decision about your eligibility. If a slot opens up later (for example when a grantee's scholarship ends), ` +
  `you can apply again from your dashboard.`;

/**
 * { [scholarship_id]: occupiedCount }. Students can't always read other
 * students' grantee rows (row-level security), so this prefers the
 * scholarship_slot_counts() database function (see
 * supabase/scholarship_slot_counts.sql) and falls back to counting directly,
 * which works for coordinators.
 */
export async function fetchOccupiedMap(supabase) {
  const rpc = await supabase.rpc("scholarship_slot_counts");
  if (!rpc.error && Array.isArray(rpc.data)) {
    return Object.fromEntries(rpc.data.map((r) => [String(r.scholarship_id), Number(r.occupied) || 0]));
  }
  const { data, error } = await supabase.from("grantees").select("scholarship_id").eq("status", "Active");
  if (error) {
    console.error("Couldn't load slot usage:", error.message);
    return {};
  }
  const map = {};
  (data || []).forEach((g) => { const k = String(g.scholarship_id); map[k] = (map[k] || 0) + 1; });
  return map;
}

/** Fresh check used right before an application is created or approved. Returns reason text or null. */
export async function findSlotViolation(supabase, scholarshipId) {
  const { data: scholarship } = await supabase
    .from("scholarships").select("scholarship_id, scholarship_name, slots").eq("scholarship_id", scholarshipId).maybeSingle();
  if (!scholarship || !hasLimit(scholarship)) return null;
  const occupied = (await fetchOccupiedMap(supabase))[String(scholarshipId)] || 0;
  return isFull(scholarship, occupied) ? slotsFullReason(scholarship) : null;
}

/**
 * If the scholarship is at its slot limit, cancels every Pending application
 * and notifies each student with the reason. Safe to call any time (no-op when
 * there is room). Coordinator-side only. Returns how many were cancelled.
 */
export async function closePendingIfFull(supabase, scholarshipId) {
  const { data: scholarship } = await supabase
    .from("scholarships").select("scholarship_id, scholarship_name, slots").eq("scholarship_id", scholarshipId).maybeSingle();
  if (!scholarship || !hasLimit(scholarship)) return 0;

  const occupied = (await fetchOccupiedMap(supabase))[String(scholarshipId)] || 0;
  if (!isFull(scholarship, occupied)) return 0;

  const { data: pending, error } = await supabase
    .from("scholarship_applications")
    .select("application_id, students ( user_id )")
    .eq("scholarship_id", scholarshipId)
    .eq("status", "Pending");
  if (error || !pending?.length) return 0;

  const ids = pending.map((a) => a.application_id);
  // "Cancelled" lets the student apply again later; if the database only allows the
  // original statuses, fall back to "Rejected" so the cancellation still goes through.
  let { error: updErr } = await supabase.from("scholarship_applications").update({ status: "Cancelled" }).in("application_id", ids);
  if (updErr) {
    ({ error: updErr } = await supabase.from("scholarship_applications").update({ status: "Rejected" }).in("application_id", ids));
  }
  if (updErr) { console.error("Couldn't cancel pending applications:", updErr.message); return 0; }

  await Promise.all(
    pending.map((a) =>
      notifyStudent(
        supabase,
        a.students?.user_id,
        "Application cancelled: scholarship slots are full",
        slotsFullMessage(scholarship.scholarship_name, scholarship.slots)
      )
    )
  );
  return pending.length;
}
