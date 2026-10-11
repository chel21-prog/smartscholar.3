/**
 * Application rules a coordinator can set on a scholarship (stored on the
 * scholarships row as `application_rule` + `blocked_with`).
 *
 *   open              anyone can apply, even if they already hold another
 *   no_active         only students who don't hold any active scholarship
 *   exclude_selected  can't apply while holding any of the picked scholarships
 *
 * "Holding" a scholarship means a grantees row with status "Active".
 * checkApplicationRule is pure, so the student dashboard, the submit check
 * and the coordinator approval all use the exact same logic.
 */
export const RULE_OPEN = "open";
export const RULE_NO_ACTIVE = "no_active";
export const RULE_EXCLUDE = "exclude_selected";

export const RULE_OPTIONS = [
  {
    value: RULE_OPEN,
    label: "Open to everyone",
    hint: "Students can apply even if they already hold another scholarship.",
  },
  {
    value: RULE_NO_ACTIVE,
    label: "Only students with no active scholarship",
    hint: "Anyone who currently holds any scholarship can't apply.",
  },
  {
    value: RULE_EXCLUDE,
    label: "Not alongside specific scholarships",
    hint: "Students who currently hold any of the scholarships you pick can't apply.",
  },
];

const key = (v) => String(v);

export function normalizeBlockedWith(value) {
  let list = value;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  return Array.isArray(list) ? list.map(key) : [];
}

const nameOf = (id, scholarships) =>
  scholarships.find((s) => key(s.scholarship_id) === key(id))?.scholarship_name || "another scholarship";

const joinNames = (names) => {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] || "";
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
};

/** Short human-readable summary of a scholarship's rule (coordinator view). */
export function describeRule(scholarship, scholarships = []) {
  const rule = scholarship?.application_rule || RULE_OPEN;
  if (rule === RULE_NO_ACTIVE) return "Only students with no active scholarship";
  if (rule === RULE_EXCLUDE) {
    const names = normalizeBlockedWith(scholarship.blocked_with).map((id) => nameOf(id, scholarships));
    return names.length ? `Not alongside ${joinNames(names)}` : "Not alongside specific scholarships (none picked yet)";
  }
  return "Open to everyone";
}

/**
 * @param scholarship   the scholarship being applied for
 * @param activeGrants  the student's grantees rows ({ scholarship_id, status? })
 * @param scholarships  all scholarships, only used to turn ids into names
 * @param subject       who the message is about: "You" for the student's own screen,
 *                      or the student's first name when a coordinator is the reader
 * @returns { allowed: boolean, reason: string | null }
 */
export function checkApplicationRule(scholarship, activeGrants = [], scholarships = [], subject = "You") {
  const you = subject === "You";
  const holds = you ? "You currently hold" : `${subject} currently holds`;
  const whichHeld = you ? "which you currently hold" : `which ${subject} currently holds`;
  const rule = scholarship?.application_rule || RULE_OPEN;
  // holding this very scholarship is a different problem (duplicate), not a stacking one
  const held = activeGrants.filter(
    (g) => (g.status === undefined || g.status === "Active") && key(g.scholarship_id) !== key(scholarship?.scholarship_id)
  );

  if (rule === RULE_NO_ACTIVE && held.length > 0) {
    const names = joinNames(held.map((g) => nameOf(g.scholarship_id, scholarships)));
    return {
      allowed: false,
      reason: `Only open to students with no active scholarship. ${holds} ${names}.`,
    };
  }

  if (rule === RULE_EXCLUDE) {
    const blocked = new Set(normalizeBlockedWith(scholarship.blocked_with));
    const clash = held.filter((g) => blocked.has(key(g.scholarship_id)));
    if (clash.length > 0) {
      const names = joinNames(clash.map((g) => nameOf(g.scholarship_id, scholarships)));
      return { allowed: false, reason: `Can't be held together with ${names}, ${whichHeld}.` };
    }
  }

  return { allowed: true, reason: null };
}

export async function fetchActiveGrants(supabase, studentId) {
  const { data, error } = await supabase
    .from("grantees")
    .select("scholarship_id, status")
    .eq("student_id", studentId)
    .eq("status", "Active");
  if (error) {
    console.error("Couldn't load active scholarships:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fresh, server-side check used right before something is created
 * (student submit, coordinator approval/grant). Returns the reason text,
 * or null when the student is allowed. Skips the extra queries for open
 * scholarships and for databases that haven't added the rule columns yet.
 */
export async function findRuleViolation(supabase, studentId, scholarshipId, subject = "You") {
  const { data: scholarship } = await supabase
    .from("scholarships")
    .select("*")
    .eq("scholarship_id", scholarshipId)
    .maybeSingle();

  if (!scholarship || !scholarship.application_rule || scholarship.application_rule === RULE_OPEN) return null;

  const [grants, { data: names }] = await Promise.all([
    fetchActiveGrants(supabase, studentId),
    supabase.from("scholarships").select("scholarship_id, scholarship_name"),
  ]);
  return checkApplicationRule(scholarship, grants, names || [], subject).reason;
}
