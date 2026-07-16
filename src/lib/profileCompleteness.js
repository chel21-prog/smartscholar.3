// Single source of truth for "is this student's profile complete enough
// to use the rest of the portal". Previously this exact check was
// copy-pasted independently in ProfileGuard.jsx, Login.jsx, and
// AuthCallback.jsx — all three required `middle_name`, which permanently
// locks out any student who genuinely doesn't have one (common in the
// Philippines and plenty of other places) since there's nothing truthy
// they could ever enter. Middle name is intentionally left out of the
// required list below.
//
// `userData` is a row from `users` (first_name, middle_name, last_name).
// `studentData` is a row from `students` (school_id, course, year_level,
// gender, ethnicity, contact_number).

export const REQUIRED_STUDENT_FIELDS = [
  { key: "first_name",     label: "First name",     source: "user" },
  { key: "last_name",      label: "Last name",      source: "user" },
  { key: "school_id",      label: "School ID",      source: "student" },
  { key: "course",         label: "Program",        source: "student" },
  { key: "year_level",     label: "Year level",     source: "student" },
  { key: "gender",         label: "Gender",         source: "student" },
  { key: "ethnicity",      label: "Ethnicity",      source: "student" },
  { key: "contact_number", label: "Contact number", source: "student" },
];

/** Returns the list of { key, label } entries that are still missing. */
export function getMissingProfileFields(userData, studentData) {
  return REQUIRED_STUDENT_FIELDS.filter(({ key, source }) => {
    const value = source === "user" ? userData?.[key] : studentData?.[key];
    return !value;
  });
}

export function isStudentProfileComplete(userData, studentData) {
  return getMissingProfileFields(userData, studentData).length === 0;
}
