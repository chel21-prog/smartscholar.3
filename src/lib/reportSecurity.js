import { supabase } from "@/lib/supabase";

const TABLE = "report_security_settings";

// Characters chosen to avoid visual ambiguity (no 0/O, 1/l/I) since this
// password gets read aloud, retyped, or shared over chat with whoever
// the PDF is sent to.
const PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateStrongPassword(length = 10) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return out;
}

/**
 * Single shared setting (same pattern as academic_settings) — one
 * password policy for every exported report PDF, managed by whichever
 * coordinator last touched it.
 * Returns null if the table hasn't been created yet or has no row.
 */
export async function getReportSecurity() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Table not created yet, or RLS blocked it — treat as "protection
    // unavailable" rather than throwing, so report generation still works
    // for everyone even before the DB migration has been run.
    console.error("report_security_settings unavailable:", error.message);
    return null;
  }
  return data; // { id, enabled, password, updated_at, updated_by } | null
}

export async function saveReportSecurity({ id, enabled, password, updatedBy }) {
  const payload = {
    enabled,
    password,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  };

  if (id) {
    const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}
