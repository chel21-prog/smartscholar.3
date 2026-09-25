import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/ui/Modal";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import InfoTooltip from "@/components/ui/InfoTooltip";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { getCached, setCached } from "@/lib/dataCache";
import { useToast } from "@/context/ToastContext";
import styles from "./Grantees.module.css";

const CACHE_KEY = "coordinator-grantees";

const VERIFICATION_LABELS = {
  Verified: "Verified",
  "Pending Review": "Pending Review",
  Ineligible: "Ineligible",
};

const BLANK_NEW_STUDENT = {
  first_name: "", middle_name: "", last_name: "",
  school_id: "", course: "", year_level: "", contact_number: "",
};
const BLANK_RELEASE_ROW = () => ({
  key: Math.random().toString(36).slice(2),
  academic_year: "", semester: "1st Semester",
  amount_released: "", release_date: "", status: "Released",
});

// ── bulk file import ────────────────────────────────────────
const CSV_COLUMNS = [
  "first_name", "middle_name", "last_name", "school_id", "course", "year_level",
  "contact_number", "scholarship_name", "academic_year", "semester",
  "date_awarded", "status", "verification_result",
];
const CSV_TEMPLATE_EXAMPLE = [
  "Juan", "Reyes", "Dela Cruz", "2018-0099", "BS Computer Science", "4",
  "09171234567", "CHED-TDP", "2021-2022", "1st Semester",
  "2021-08-01", "Active", "Verified",
];
const VALID_SEMESTERS = ["1st Semester", "2nd Semester"];
const VALID_STATUSES = ["Active", "Inactive", "Pending"];
const VALID_VERIFICATIONS = ["Verified", "Pending Review", "Ineligible"];
const AY_PATTERN = /^\d{4}\s*-\s*\d{4}$/;

// Case/whitespace-tolerant match against a fixed set of allowed values —
// used so "active", " Active ", "ACTIVE" in a spreadsheet all resolve to
// the exact string the grantees table's CHECK constraint expects, instead
// of failing the whole row (or worse, the whole batch insert) over
// formatting the coordinator can't be expected to get byte-perfect.
function normalizeAgainst(value, allowed) {
  const found = allowed.find(a => a.toLowerCase() === String(value || "").trim().toLowerCase());
  return found || null;
}

export default function Grantees() {
  const navigate = useNavigate();
  const toast = useToast();
  const cachedRows = getCached(CACHE_KEY);
  const [rows, setRows] = useState(cachedRows || []);
  const [loading, setLoading] = useState(!cachedRows);
  const [currentPage, setCurrentPage] = useState(1);
const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search,setSearch]=useState("");
  const [statusFilter, setStatusFilter] = useState("All");
const [scholarshipFilter, setScholarshipFilter] = useState("All");
const [semesterFilter, setSemesterFilter] = useState("All");
const [yearFilter, setYearFilter] = useState("All");
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── verification modal ────────────────────────────────────
  const [verifyTarget, setVerifyTarget] = useState(null); // the row being verified
  const [regStatus, setRegStatus] = useState("");
  const [regYearLevel, setRegYearLevel] = useState("");
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [verifyResult, setVerifyResult] = useState("");
  const [terminationReason, setTerminationReason] = useState("");
  const [savingVerification, setSavingVerification] = useState(false);

  // ── add historical grantee modal ───────────────────────────
  // Lets the coordinator backfill scholars who were already granted
  // before this system existed — either linking to a student who's
  // already in the system, or creating a bare-bones student record on
  // the spot (no login credentials; users.auth_id stays null until that
  // person eventually signs up for real, if ever). Uses grantees.source
  // = "Manual" — the schema already has this value defined specifically
  // for entries that didn't come through the normal application flow.
  const [showAddGrantee,   setShowAddGrantee]   = useState(false);
  const [scholarshipsList, setScholarshipsList] = useState([]);
  const [studentMode,      setStudentMode]      = useState("existing"); // "existing" | "new"
  const [studentSearch,    setStudentSearch]    = useState("");
  const [studentResults,   setStudentResults]   = useState([]);
  const [searchingStudent, setSearchingStudent]  = useState(false);
  const [selectedStudent,  setSelectedStudent]  = useState(null);
  const [newStudent,       setNewStudent]       = useState(BLANK_NEW_STUDENT);
  const [granteeScholarshipId, setGranteeScholarshipId] = useState("");
  const [granteeAcademicYear,  setGranteeAcademicYear]  = useState("");
  const [granteeSemester,      setGranteeSemester]      = useState("1st Semester");
  const [granteeDateAwarded,   setGranteeDateAwarded]   = useState("");
  const [granteeStatus,        setGranteeStatus]        = useState("Active");
  const [granteeVerification,  setGranteeVerification]  = useState("Verified");
  const [releaseRows,          setReleaseRows]          = useState([]);
  const [savingGrantee,        setSavingGrantee]        = useState(false);

  // ── bulk file import ──
  const [showImport,     setShowImport]     = useState(false);
  const [importStep,     setImportStep]     = useState("upload"); // "upload" | "preview" | "results"
  const [importFileName, setImportFileName] = useState("");
  const [importRows,     setImportRows]     = useState([]); // parsed + validated
  const [parsingFile,    setParsingFile]    = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [importResults,  setImportResults]  = useState({ succeeded: 0, failed: [] });

  useEffect(() => {
    load();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const { data } = await supabase.auth.getUser();
    const authUser = data?.user;
    if (!authUser) return;
    const { data: userRow } = await supabase
      .from("users")
      .select("user_id")
      .eq("auth_id", authUser.id)
      .single();
    setCurrentUserId(userRow?.user_id ?? null);
  };

  // ── add historical grantee: helpers ────────────────────────
  const openAddGrantee = async () => {
    setStudentMode("existing");
    setStudentSearch(""); setStudentResults([]); setSelectedStudent(null);
    setNewStudent(BLANK_NEW_STUDENT);
    setGranteeScholarshipId(""); setGranteeAcademicYear("");
    setGranteeSemester("1st Semester"); setGranteeDateAwarded("");
    setGranteeStatus("Active"); setGranteeVerification("Verified");
    setReleaseRows([]);
    setShowAddGrantee(true);

    if (scholarshipsList.length === 0) {
      const { data } = await supabase
        .from("scholarships")
        .select("scholarship_id, scholarship_name, status")
        .order("scholarship_name", { ascending: true });
      setScholarshipsList(data || []);
    }
  };

  // Debounced live search against existing students, by name or school ID.
  useEffect(() => {
    if (!showAddGrantee || studentMode !== "existing") return;
    const q = studentSearch.trim();
    if (q.length < 2) { setStudentResults([]); return; }

    setSearchingStudent(true);
    const handle = setTimeout(async () => {
      // Two simple, single-table queries instead of one query trying to
      // filter across the students→users join in one shot — more moving
      // parts, but every piece here is a plain .select()/.eq()/.ilike()/
      // .in(), the same shape already used everywhere else in this app.
      const [{ data: bySchoolId }, { data: matchingUsers }] = await Promise.all([
        supabase
          .from("students")
          .select("student_id, school_id, course, year_level, users(first_name, last_name)")
          .ilike("school_id", `%${q}%`)
          .limit(20),
        supabase
          .from("users")
          .select("user_id, first_name, last_name")
          .eq("role", "Student")
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(20),
      ]);

      let byName = [];
      if (matchingUsers && matchingUsers.length > 0) {
        const { data } = await supabase
          .from("students")
          .select("student_id, school_id, course, year_level, users(first_name, last_name)")
          .in("user_id", matchingUsers.map(u => u.user_id));
        byName = data || [];
      }

      const merged = new Map();
      [...(bySchoolId || []), ...byName].forEach(s => merged.set(s.student_id, s));
      setStudentResults([...merged.values()]);
      setSearchingStudent(false);
    }, 350);

    return () => clearTimeout(handle);
  }, [studentSearch, studentMode, showAddGrantee]);

  const addReleaseRow = () => setReleaseRows(prev => [...prev, BLANK_RELEASE_ROW()]);
  const removeReleaseRow = (key) => setReleaseRows(prev => prev.filter(r => r.key !== key));
  const updateReleaseRow = (key, field, value) =>
    setReleaseRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));

  const submitAddGrantee = async () => {
    // ── validation ──
    if (studentMode === "existing" && !selectedStudent) {
      toast.error("Search for and select the student first.");
      return;
    }
    if (studentMode === "new") {
      if (!newStudent.first_name.trim() || !newStudent.last_name.trim()) {
        toast.error("Enter the student's first and last name.");
        return;
      }
      if (!newStudent.school_id.trim()) {
        toast.error("Enter the student's school ID.");
        return;
      }
    }
    if (!granteeScholarshipId) { toast.error("Select which scholarship this grantee held."); return; }
    if (!granteeAcademicYear.trim()) { toast.error("Enter the academic year they were awarded (e.g. 2022-2023)."); return; }
    if (!granteeDateAwarded) { toast.error("Enter the date they were awarded — this anchors their payout schedule, so it needs to be accurate."); return; }
    for (const r of releaseRows) {
      if (!r.academic_year.trim() || !r.amount_released || !r.release_date) {
        toast.error("Fill in academic year, amount, and date for every past release row, or remove the empty one.");
        return;
      }
    }

    setSavingGrantee(true);

    let studentId = selectedStudent?.student_id;

    // ── create a bare student record if migrating someone not yet in the system ──
    if (studentMode === "new") {
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .insert({
          auth_id: null, // no login yet — this is a record-only placeholder
          email: null,
          first_name: newStudent.first_name.trim(),
          middle_name: newStudent.middle_name.trim() || null,
          last_name: newStudent.last_name.trim(),
          role: "Student",
          status: "active",
        })
        .select().single();

      if (userError) { toast.error(userError.message); setSavingGrantee(false); return; }

      const { data: studentRow, error: studentError } = await supabase
        .from("students")
        .insert({
          user_id: userRow.user_id,
          school_id: newStudent.school_id.trim(),
          course: newStudent.course.trim() || null,
          year_level: newStudent.year_level ? Number(newStudent.year_level) : null,
          contact_number: newStudent.contact_number.trim() || null,
          status: "Enrolled",
        })
        .select().single();

      if (studentError) {
        toast.error(
          studentError.message.includes("duplicate")
            ? `School ID "${newStudent.school_id}" is already in the system — search for them under "Existing student" instead.`
            : studentError.message
        );
        setSavingGrantee(false);
        return;
      }
      studentId = studentRow.student_id;
    }

    // ── the grantee record itself ──
    const { data: granteeRow, error: granteeError } = await supabase
      .from("grantees")
      .insert({
        student_id: studentId,
        scholarship_id: granteeScholarshipId,
        status: granteeStatus,
        date_awarded: granteeDateAwarded,
        academic_year: granteeAcademicYear.trim(),
        semester: granteeSemester,
        verification_result: granteeVerification,
        verification_remarks: "Migrated from records predating the system.",
        last_verified_at: new Date().toISOString(),
        verified_by: currentUserId,
        source: "Manual",
      })
      .select().single();

    if (granteeError) { toast.error(granteeError.message); setSavingGrantee(false); return; }

    // ── optional past releases, so the payout schedule reflects reality ──
    if (releaseRows.length > 0) {
      const { error: releaseError } = await supabase.from("fund_releases").insert(
        releaseRows.map(r => ({
          grantee_id: granteeRow.grantee_id,
          academic_year: r.academic_year.trim(),
          semester: r.semester,
          amount_released: Number(r.amount_released),
          release_date: r.release_date,
          status: r.status,
          remarks: "Migrated from records predating the system.",
        }))
      );
      if (releaseError) {
        toast.error("Grantee saved, but past releases failed to save: " + releaseError.message);
        setSavingGrantee(false);
        setShowAddGrantee(false);
        load();
        return;
      }
    }

    setSavingGrantee(false);
    setShowAddGrantee(false);
    toast.success("Historical grantee added.");
    load();
  };

  // ── bulk file import: template, parse+validate, commit ─────
  const downloadCsvTemplate = () => {
    const csv = Papa.unparse([CSV_COLUMNS, CSV_TEMPLATE_EXAMPLE]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historical_grantees_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openImport = () => {
    setImportStep("upload");
    setImportFileName("");
    setImportRows([]);
    setImportResults({ succeeded: 0, failed: [] });
    setShowImport(true);
  };

  // Parses the file, then cross-checks every row against real DB state in
  // a small number of batch queries (not one query per row) so nothing
  // gets written until the coordinator has reviewed exactly what will
  // happen — new student vs. linking to an existing one, which scholarship
  // it resolved to, and anything that looks like a duplicate.
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setImportFileName(file.name);
    setParsingFile(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: async (results) => {
        const raw = results.data;
        if (raw.length === 0) {
          toast.error("That file has no data rows.");
          setParsingFile(false);
          return;
        }
        await validateImportRows(raw);
        setParsingFile(false);
        setImportStep("preview");
      },
      error: (err) => {
        toast.error("Couldn't read that file: " + err.message);
        setParsingFile(false);
      },
    });
  };

  const validateImportRows = async (raw) => {
    // batch lookups instead of one query per row
    const { data: allScholarships } = await supabase
      .from("scholarships").select("scholarship_id, scholarship_name");
    const scholarshipByName = new Map(
      (allScholarships || []).map(s => [s.scholarship_name.trim().toLowerCase(), s])
    );

    const schoolIds = [...new Set(raw.map(r => (r.school_id || "").trim()).filter(Boolean))];
    const { data: existingStudents } = schoolIds.length > 0
      ? await supabase
          .from("students")
          .select("student_id, school_id, existingGrantees:grantees(scholarship_id, academic_year, semester), users(first_name, last_name)")
          .in("school_id", schoolIds)
      : { data: [] };
    const studentBySchoolId = new Map((existingStudents || []).map(s => [s.school_id, s]));

    const seenInFile = new Map(); // school_id -> first row index that used it

    const validated = raw.map((r, i) => {
      const errors = [];
      const warnings = [];
      const school_id = (r.school_id || "").trim();
      const first_name = (r.first_name || "").trim();
      const last_name = (r.last_name || "").trim();
      const scholarship_name = (r.scholarship_name || "").trim();
      const academic_year = (r.academic_year || "").trim();
      const date_awarded = (r.date_awarded || "").trim();

      if (!first_name) errors.push("Missing first_name");
      if (!last_name) errors.push("Missing last_name");
      if (!school_id) errors.push("Missing school_id");
      if (!scholarship_name) errors.push("Missing scholarship_name");
      if (!academic_year) errors.push("Missing academic_year");
      else if (!AY_PATTERN.test(academic_year)) errors.push(`academic_year "${academic_year}" doesn't look like "2022-2023"`);
      if (!date_awarded) errors.push("Missing date_awarded");
      else if (isNaN(new Date(date_awarded))) errors.push(`date_awarded "${date_awarded}" isn't a valid date`);

      const semester = normalizeAgainst(r.semester, VALID_SEMESTERS);
      if (!r.semester?.trim()) errors.push("Missing semester");
      else if (!semester) errors.push(`semester "${r.semester}" must be "1st Semester" or "2nd Semester"`);

      const status = r.status?.trim() ? normalizeAgainst(r.status, VALID_STATUSES) : "Active";
      if (r.status?.trim() && !status) errors.push(`status "${r.status}" must be Active, Inactive, or Pending`);

      const verification_result = r.verification_result?.trim()
        ? normalizeAgainst(r.verification_result, VALID_VERIFICATIONS) : "Verified";
      if (r.verification_result?.trim() && !verification_result) {
        errors.push(`verification_result "${r.verification_result}" must be Verified, Pending Review, or Ineligible`);
      }

      let year_level = null;
      if (r.year_level?.trim()) {
        const n = Number(r.year_level);
        if (isNaN(n)) errors.push(`year_level "${r.year_level}" isn't a number`);
        else year_level = n;
      }

      const scholarshipMatch = scholarship_name ? scholarshipByName.get(scholarship_name.toLowerCase()) : null;
      if (scholarship_name && !scholarshipMatch) errors.push(`No scholarship named "${scholarship_name}" — check spelling, or add it under Scholarships first`);

      const studentMatch = school_id ? studentBySchoolId.get(school_id) : null;
      if (studentMatch) {
        warnings.push(`School ID already in the system — will link to ${studentMatch.users?.first_name} ${studentMatch.users?.last_name} instead of creating a new student`);
        const dupeGrant = (studentMatch.existingGrantees || []).some(g =>
          scholarshipMatch && g.scholarship_id === scholarshipMatch.scholarship_id &&
          g.academic_year === academic_year && g.semester === semester
        );
        if (dupeGrant) warnings.push("This student already has a grantee record for this exact scholarship, academic year, and semester — likely a duplicate import");
      }

      if (school_id) {
        if (seenInFile.has(school_id)) {
          errors.push(`Duplicate school_id within this file (also on row ${seenInFile.get(school_id) + 2})`);
        } else {
          seenInFile.set(school_id, i);
        }
      }

      return {
        rowNumber: i + 2, // +1 for header row, +1 for 1-indexing
        first_name, middle_name: (r.middle_name || "").trim(), last_name,
        school_id, course: (r.course || "").trim(), year_level,
        contact_number: (r.contact_number || "").trim(),
        scholarship_name, scholarship_id: scholarshipMatch?.scholarship_id || null,
        academic_year, semester: semester || r.semester?.trim() || "",
        date_awarded, status: status || "Active", verification_result: verification_result || "Verified",
        studentMatch,
        errors, warnings,
      };
    });

    setImportRows(validated);
  };

  const importReadyRows = importRows.filter(r => r.errors.length === 0);

  const commitImport = async () => {
    if (importReadyRows.length === 0) return;
    setImporting(true);

    const succeeded = [];
    const failed = [];

    for (const row of importReadyRows) {
      let studentId = row.studentMatch?.student_id;

      if (!studentId) {
        const { data: userRow, error: userError } = await supabase
          .from("users")
          .insert({
            auth_id: null, email: null,
            first_name: row.first_name, middle_name: row.middle_name || null, last_name: row.last_name,
            role: "Student", status: "active",
          })
          .select().single();

        if (userError) { failed.push({ row: row.rowNumber, name: `${row.first_name} ${row.last_name}`, reason: userError.message }); continue; }

        const { data: studentRow, error: studentError } = await supabase
          .from("students")
          .insert({
            user_id: userRow.user_id, school_id: row.school_id,
            course: row.course || null, year_level: row.year_level,
            contact_number: row.contact_number || null, status: "Enrolled",
          })
          .select().single();

        if (studentError) {
          failed.push({
            row: row.rowNumber, name: `${row.first_name} ${row.last_name}`,
            reason: studentError.message.includes("duplicate")
              ? `School ID "${row.school_id}" collided with an existing record (added after this import started)`
              : studentError.message,
          });
          continue;
        }
        studentId = studentRow.student_id;
      }

      const { error: granteeError } = await supabase.from("grantees").insert({
        student_id: studentId,
        scholarship_id: row.scholarship_id,
        status: row.status,
        date_awarded: row.date_awarded,
        academic_year: row.academic_year,
        semester: row.semester,
        verification_result: row.verification_result,
        verification_remarks: "Imported from file — migrated from records predating the system.",
        last_verified_at: new Date().toISOString(),
        verified_by: currentUserId,
        source: "Imported",
      });

      if (granteeError) {
        failed.push({ row: row.rowNumber, name: `${row.first_name} ${row.last_name}`, reason: granteeError.message });
        continue;
      }

      succeeded.push(row.rowNumber);
    }

    setImporting(false);
    setImportResults({ succeeded: succeeded.length, failed });
    setImportStep("results");
    load();
  };

  useEffect(() => {
  setCurrentPage(1);
}, [
  search,
  statusFilter,
  scholarshipFilter,
  semesterFilter,
  yearFilter,
]);
  const load = async () => {
  if (!getCached(CACHE_KEY)) setLoading(true);

  const { data, error } = await supabase
    .from("grantees")
    .select(`
      grantee_id,
      student_id,
      application_id,
      scholarship_id,
      status,
      date_awarded,
      academic_year,
      semester,
      verification_result,
      verification_remarks,
      termination_reason,
      last_verified_at,
      source,

      students (
        school_id,
        course,
        year_level,
        status,
        users (
          first_name,
          last_name
        )
      ),

      scholarships (
        scholarship_name
      )
    `)
    .order("date_awarded", { ascending: false });

  if (error) {
    console.error(error.message);
    setLoading(false);
    return;
  }

  const { data: docs } = await supabase
    .from("application_documents")
    .select("*")
    .in(
      "application_id",
      (data || []).map((g) => g.application_id)
    );

  const formatted = (data || []).map((g) => {
    const granteeDocs =
      docs?.filter((d) => d.application_id === g.application_id) || [];

    const first = g.students?.users?.first_name ?? "";
    const last = g.students?.users?.last_name ?? "";

    return {
      grantee_id: g.grantee_id,
      school_id: g.students?.school_id ?? "N/A",
      student_name: `${first} ${last}`.trim() || "Unknown",
      course: g.students?.course ?? "N/A",
      year_level: g.students?.year_level ?? "N/A",
      student_status: g.students?.status ?? "N/A",
      scholarship_name: g.scholarships?.scholarship_name ?? "N/A",
      status: g.status,
      academic_year: g.academic_year ?? "N/A",
      semester: g.semester ?? "N/A",
      date_awarded: g.date_awarded,
      verification_result: g.verification_result ?? "Pending Review",
      verification_remarks: g.verification_remarks,
      termination_reason: g.termination_reason,
      last_verified_at: g.last_verified_at,
      source: g.source ?? "Application",

      documents: granteeDocs,
    };
  });

  setRows(formatted);
  setCached(CACHE_KEY, formatted);
  setLoading(false);
};

  const openVerify = (row) => {
    setVerifyTarget(row);
    setRegStatus("");
    setRegYearLevel("");
    setVerifyRemarks("");
    setVerifyResult("");
    setTerminationReason("");
  };

  const closeVerify = () => setVerifyTarget(null);

  const submitVerification = async () => {
    if (!verifyTarget || !verifyResult) return;
    if (verifyResult === "Ineligible" && !terminationReason.trim()) {
      toast.error("Enter a reason before marking this grantee ineligible.");
      return;
    }

    setSavingVerification(true);

    // grantees.verification_result only supports Verified / Pending Review /
    // Ineligible today, so "Mismatch" is recorded as Pending Review at the
    // grantee level and kept precise in the grantee_verifications history.
    const granteeUpdate =
      verifyResult === "Eligible"
        ? { verification_result: "Verified", status: "Active" }
        : verifyResult === "Mismatch"
        ? { verification_result: "Pending Review" }
        : { verification_result: "Ineligible", status: "Inactive", termination_reason: terminationReason };

    const remarks = regStatus || regYearLevel
      ? `Registrar: ${regStatus || "—"}${regYearLevel ? `, Year ${regYearLevel}` : ""}. ${verifyRemarks}`.trim()
      : verifyRemarks;

    const { error: updateError } = await supabase
      .from("grantees")
      .update({
        ...granteeUpdate,
        verification_remarks: remarks || null,
        last_verified_at: new Date().toISOString(),
        verified_by: currentUserId,
      })
      .eq("grantee_id", verifyTarget.grantee_id);

    if (updateError) {
      toast.error(updateError.message);
      setSavingVerification(false);
      return;
    }

    const { error: historyError } = await supabase
      .from("grantee_verifications")
      .insert({
        grantee_id: verifyTarget.grantee_id,
        academic_year: verifyTarget.academic_year,
        semester: verifyTarget.semester,
        verification_status: verifyResult,
        remarks: remarks || null,
        verified_by: currentUserId,
      });

    if (historyError) {
      toast.error(historyError.message);
    }

    setSavingVerification(false);
    closeVerify();
    load();
  };

  const grouped = rows.reduce((acc, r) => {
  const key = r.school_id; // better if you use student_id

  if (!acc[key]) {
    acc[key] = {
      school_id: r.school_id,
      student_name: r.student_name,
      scholarships: [],
    };
  }

  acc[key].scholarships.push(r);

  return acc;
}, {});

const scholarshipOptions = [
  "All",
  ...new Set(rows.map(r => r.scholarship_name))
];

const yearOptions = [
  "All",
  ...new Set(rows.map(r => r.academic_year))
];

const semesterOptions = [
  "All",
  ...new Set(rows.map(r => r.semester))
];

const statusOptions = [
  "All",
  ...new Set(rows.map(r => r.status))
];

const filtered = Object.values(grouped)
  .map(student => ({
    ...student,
    scholarships: student.scholarships.filter(s => {

      const keyword = search.toLowerCase();

      const matchesSearch =
        student.student_name.toLowerCase().includes(keyword) ||
        (student.school_id || "").toLowerCase().includes(keyword) ||
        s.scholarship_name.toLowerCase().includes(keyword) ||
        s.status.toLowerCase().includes(keyword) ||
        s.academic_year.toLowerCase().includes(keyword) ||
        s.semester.toLowerCase().includes(keyword) ||
        (s.date_awarded &&
          new Date(s.date_awarded)
            .toLocaleDateString()
            .toLowerCase()
            .includes(keyword));

      const matchesStatus =
        statusFilter === "All" ||
        s.status === statusFilter;

      const matchesScholarship =
        scholarshipFilter === "All" ||
        s.scholarship_name === scholarshipFilter;

      const matchesSemester =
        semesterFilter === "All" ||
        s.semester === semesterFilter;

      const matchesYear =
        yearFilter === "All" ||
        s.academic_year === yearFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesScholarship &&
        matchesSemester &&
        matchesYear
      );

    })
  }))
  .filter(student => student.scholarships.length > 0);
  
  const tableRows = [];

filtered.forEach((student) => {
  student.scholarships.forEach((scholarship) => {
    tableRows.push({
      student,
      scholarship,
    });
  });
});
  const totalPages = Math.ceil(
    tableRows.length / rowsPerPage
);

const paginated = tableRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
);
const startRow =
  tableRows.length === 0
    ? 0
    : (currentPage - 1) * rowsPerPage + 1;

const endRow =
  tableRows.length === 0
    ? 0
    : Math.min(
        currentPage * rowsPerPage,
        tableRows.length
      );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
    <div>
        <h1 className={styles.title}>
            Scholarship Grantees
        </h1>

        <p className={styles.subtitle}>
            View all approved scholarship recipients and their submitted requirements.
        </p>
    </div>
    <button
      onClick={() => navigate("/coordinator/dashboard", { state: { openReport: { type: "grantees", returnTo: "/coordinator/grantees" } } })}
      style={{ padding:"9px 16px", background:"var(--teal-600)", color:"#fff", border:"none", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:13 }}
    >
      Generate Report
    </button>
    <button
      onClick={openAddGrantee}
      style={{ padding:"9px 16px", background:"var(--navy-600)", color:"#fff", border:"none", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:13, marginLeft:10 }}
    >
      + Add Historical Grantee
    </button>
    <button
      onClick={openImport}
      style={{ padding:"9px 16px", background:"var(--surface)", color:"var(--navy-700)", border:"1px solid var(--navy-300)", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:13, marginLeft:10 }}
    >
      Import from File
    </button>
</div>
    
    <div className={styles.statsRow}>
  <div className={styles.statCard}>
    <div className={styles.statNumber}>{rows.length}</div>
    <div className={styles.statLabelRow}>
      <span className={styles.statLabel}>Scholarship Awards</span>
      <InfoTooltip label="Scholarship Awards">
        Total number of grantee rows loaded — one row per student-scholarship award.
      </InfoTooltip>
    </div>
  </div>

  <div className={styles.statCard}>
    <div className={styles.statNumber}>
      {Object.keys(grouped).length}
    </div>
    <div className={styles.statLabelRow}>
      <span className={styles.statLabel}>Total Grantees</span>
      <InfoTooltip label="Total Grantees">
        Distinct students who hold at least one scholarship award, after grouping all awards by student.
      </InfoTooltip>
    </div>
  </div>

  <div className={styles.statCard}>
    <div className={styles.statNumber}>
      {rows.filter((r) => r.status === "Active").length}
    </div>
    <div className={styles.statLabelRow}>
      <span className={styles.statLabel}>Active Grantees</span>
      <InfoTooltip label="Active Grantees">
        Count of grantee awards whose status is exactly "Active".
      </InfoTooltip>
    </div>
  </div>
</div>

<SearchFilterBar
  search={search}
  onSearchChange={(v) => { setSearch(v); setCurrentPage(1); }}
  searchPlaceholder="Search by student, school ID, scholarship, status, AY, semester..."
  resultCount={tableRows.length}
  totalCount={rows.length}
  filters={[
    {
      label: "Status",
      value: statusFilter,
      onChange: (v) => { setStatusFilter(v); setCurrentPage(1); },
      options: statusOptions.map((o) => ({ value: o, label: o === "All" ? "All Status" : o })),
    },
    {
      label: "Scholarship",
      value: scholarshipFilter,
      onChange: (v) => { setScholarshipFilter(v); setCurrentPage(1); },
      options: scholarshipOptions.map((o) => ({ value: o, label: o === "All" ? "All Scholarships" : o })),
      width: 220,
    },
    {
      label: "Academic Year",
      value: yearFilter,
      onChange: (v) => { setYearFilter(v); setCurrentPage(1); },
      options: yearOptions.map((o) => ({ value: o, label: o === "All" ? "All Academic Years" : o })),
    },
    {
      label: "Semester",
      value: semesterFilter,
      onChange: (v) => { setSemesterFilter(v); setCurrentPage(1); },
      options: semesterOptions.map((o) => ({ value: o, label: o === "All" ? "All Semesters" : o })),
    },
  ]}
/>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={`${styles.th} ${styles.colOptional}`}>School ID</th>
              <th className={styles.th}>Student Name</th>
              <th className={styles.th}>Scholarship</th>
              <th className={`${styles.th} ${styles.colOptional}`}>AY Approved</th>
              <th className={`${styles.th} ${styles.colOptional}`}>Semester Approved</th>
              <th className={`${styles.th} ${styles.colOptional}`}>Date Approved</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Verification</th>
              <th className={styles.th}>Documents</th>
              <th className={styles.th}>Action</th>
            </tr>
          </thead>

          <tbody>
  {loading ? (
    <tr>
      <td colSpan={10} style={{ padding: "14px 16px" }}>
        <TableSkeleton columns={10} rows={6} />
      </td>
    </tr>
  ) : paginated.map((row) => {
    const student = row.student;
    const s = row.scholarship;

    return (
      <tr key={s.grantee_id}>

        <td className={`${styles.td} ${styles.colOptional}`}>
    {student.school_id}
</td>

<td className={styles.td}>
    {student.student_name}
</td>
        <td className={styles.td}>
          {s.scholarship_name}
        </td>

        <td className={`${styles.td} ${styles.colOptional}`}>
          {s.academic_year}
        </td>

        <td className={`${styles.td} ${styles.colOptional}`}>
          {s.semester}
        </td>

        <td className={`${styles.td} ${styles.colOptional}`}>
          {s.date_awarded
            ? new Date(s.date_awarded).toLocaleDateString()
            : "Not set"}
        </td>

        <td className={styles.td}>
          <span
            className={`${styles.badge} ${
              s.status === "Active"
                ? styles.active
                : styles.inactive
            }`}
          >
            {s.status}
          </span>
        </td>

        <td className={styles.td}>
  <span
    className={`${styles.badge} ${
      s.verification_result === "Verified"
        ? styles.active
        : styles.inactive
    }`}
  >
    {VERIFICATION_LABELS[s.verification_result] || s.verification_result}
  </span>
</td>
<td className={styles.td}>
  {!s.documents || s.documents.length === 0 ? (
    <span className={styles.documentPlaceholder}>
      No files uploaded
    </span>
  ) : (
    <div className={styles.documents}>
      {s.documents.map((d, i) => (
        <a
          key={i}
          href={d.file_url}
          target="_blank"
          rel="noreferrer"
          className={styles.documentButton}
        >
          {d.requirement_name || "View"}
        </a>
      ))}
    </div>
  )}
</td>
<td className={`${styles.td} ${styles.actionCell}`}>
  <button
    className={styles.documentButton}
    onClick={() => openVerify(s)}
  >
    {s.verification_result === "Verified" ? "Re-verify" : "Verify"}
  </button>
</td>

      </tr>
    );
  })}
</tbody>
        </table>
        
      </div>
      <div className={styles.pagination}>
  <span className={styles.pageInfo}>
    {tableRows.length === 0
      ? "0"
      : `${startRow}–${endRow}`}{" "}
    of {tableRows.length}
  </span>

  <div className={styles.pageButtons}>
    <button
      className={styles.pageBtn}
      disabled={currentPage === 1}
      onClick={() => setCurrentPage((p) => p - 1)}
    >
      Previous
    </button>

    <span className={styles.pageInfo}>
      Page {tableRows.length === 0 ? 0 : currentPage} of {totalPages || 1}
    </span>

    <button
      className={styles.pageBtn}
      disabled={
        currentPage >= totalPages ||
        totalPages === 0
      }
      onClick={() => setCurrentPage((p) => p + 1)}
    >
      Next
    </button>
  </div>
</div>

      <Modal
        open={!!verifyTarget}
        onClose={closeVerify}
        title="Verify Grantee"
        footer={
          <>
            <button className={styles.pageBtn} onClick={closeVerify}>Cancel</button>
            <button
              className={styles.documentButton}
              disabled={!verifyResult || savingVerification}
              onClick={submitVerification}
            >
              {savingVerification ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {verifyTarget && (
          <div className={styles.verifyForm}>
            <div className={styles.verifySection}>
              <h4 className={styles.verifySectionTitle}>Student Information</h4>
              <div className={styles.verifyGrid}>
                <div><span className={styles.verifyLabel}>Name</span><br />{verifyTarget.student_name}</div>
                <div><span className={styles.verifyLabel}>School ID</span><br />{verifyTarget.school_id}</div>
                <div><span className={styles.verifyLabel}>Course</span><br />{verifyTarget.course}</div>
                <div><span className={styles.verifyLabel}>Year Level (on file)</span><br />{verifyTarget.year_level}</div>
              </div>
            </div>

            <div className={styles.verifySection}>
              <h4 className={styles.verifySectionTitle}>Scholarship</h4>
              <div className={styles.verifyGrid}>
                <div><span className={styles.verifyLabel}>Name</span><br />{verifyTarget.scholarship_name}</div>
                <div><span className={styles.verifyLabel}>Academic Year</span><br />{verifyTarget.academic_year}</div>
                <div><span className={styles.verifyLabel}>Semester</span><br />{verifyTarget.semester}</div>
              </div>
            </div>

            <div className={styles.verifySection}>
              <h4 className={styles.verifySectionTitle}>Registrar Verification</h4>
              <p className={styles.description}>
                Compare the student's profile above against what the registrar shows right now.
              </p>
              <div className={styles.verifyGrid}>
                <input
                  className={styles.search}
                  placeholder="Registrar enrollment status"
                  value={regStatus}
                  onChange={(e) => setRegStatus(e.target.value)}
                />
                <input
                  className={styles.search}
                  type="number"
                  placeholder="Registrar year level"
                  value={regYearLevel}
                  onChange={(e) => setRegYearLevel(e.target.value)}
                />
              </div>
            </div>

            <textarea
              className={styles.search}
              placeholder="Remarks"
              rows={2}
              value={verifyRemarks}
              onChange={(e) => setVerifyRemarks(e.target.value)}
            />

            <div className={styles.verifySection}>
              <h4 className={styles.verifySectionTitle}>Verification Result</h4>
              <div className={styles.verifyResultRow}>
                {["Eligible", "Mismatch", "Ineligible"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.select} ${verifyResult === opt ? styles.badge : ""}`}
                    onClick={() => setVerifyResult(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {verifyResult === "Ineligible" && (
                <select
                  className={styles.select}
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                >
                  <option value="">Select a reason…</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Dropped">Dropped</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Scholarship revoked">Scholarship revoked</option>
                  <option value="Other">Other</option>
                </select>
              )}

              {verifyResult === "Mismatch" && (
                <p className={styles.description}>
                  This keeps the grantee at Pending Review until they are checked again next verification cycle.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ================= ADD HISTORICAL GRANTEE ================= */}
      <Modal
        open={showAddGrantee}
        onClose={() => setShowAddGrantee(false)}
        title="Add Historical Grantee"
        size="lg"
        footer={
          <>
            <button className={styles.pageBtn} onClick={() => setShowAddGrantee(false)}>Cancel</button>
            <button
              className={styles.documentButton}
              disabled={savingGrantee}
              onClick={submitAddGrantee}
            >
              {savingGrantee ? "Saving…" : "Add Grantee"}
            </button>
          </>
        }
      >
        <div className={styles.verifyForm}>
          <p className={styles.description}>
            For scholars who were already granted before this system existed. Link them to their
            student record if they already have one here, or create a bare record for them —
            no login is created, so this never sends them anything or requires a password.
          </p>

          <div className={styles.verifySection}>
            <h4 className={styles.verifySectionTitle}>Student</h4>
            <div className={styles.verifyResultRow}>
              {[["existing", "Existing student"], ["new", "Not in the system yet"]].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.select} ${studentMode === mode ? styles.badge : ""}`}
                  onClick={() => { setStudentMode(mode); setSelectedStudent(null); }}
                >
                  {label}
                </button>
              ))}
            </div>

            {studentMode === "existing" ? (
              selectedStudent ? (
                <div className={styles.verifyGrid} style={{ marginTop: 10 }}>
                  <div>
                    <span className={styles.verifyLabel}>Selected</span><br />
                    {selectedStudent.users?.first_name} {selectedStudent.users?.last_name}
                    {" "}({selectedStudent.school_id || "no school ID on file"})
                  </div>
                  <button type="button" className={styles.pageBtn} onClick={() => setSelectedStudent(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <input
                    className={styles.search}
                    placeholder="Search by name or school ID…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                  {searchingStudent && <p className={styles.description}>Searching…</p>}
                  {!searchingStudent && studentSearch.trim().length >= 2 && studentResults.length === 0 && (
                    <p className={styles.description}>No matching students. Switch to "Not in the system yet" to create one.</p>
                  )}
                  {studentResults.length > 0 && (
                    <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                      {studentResults.map(s => (
                        <button
                          key={s.student_id}
                          type="button"
                          onClick={() => { setSelectedStudent(s); setStudentResults([]); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "9px 12px", border: "none", borderBottom: "1px solid var(--border)",
                            background: "var(--surface)", cursor: "pointer", fontSize: 13,
                          }}
                        >
                          {s.users?.first_name} {s.users?.last_name} — {s.school_id || "no school ID"} · {s.course || "—"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className={styles.verifyGrid} style={{ marginTop: 10 }}>
                <input className={styles.search} placeholder="First name *"
                  value={newStudent.first_name}
                  onChange={(e) => setNewStudent(s => ({ ...s, first_name: e.target.value }))} />
                <input className={styles.search} placeholder="Middle name"
                  value={newStudent.middle_name}
                  onChange={(e) => setNewStudent(s => ({ ...s, middle_name: e.target.value }))} />
                <input className={styles.search} placeholder="Last name *"
                  value={newStudent.last_name}
                  onChange={(e) => setNewStudent(s => ({ ...s, last_name: e.target.value }))} />
                <input className={styles.search} placeholder="School ID *"
                  value={newStudent.school_id}
                  onChange={(e) => setNewStudent(s => ({ ...s, school_id: e.target.value }))} />
                <input className={styles.search} placeholder="Course"
                  value={newStudent.course}
                  onChange={(e) => setNewStudent(s => ({ ...s, course: e.target.value }))} />
                <input className={styles.search} type="number" placeholder="Year level"
                  value={newStudent.year_level}
                  onChange={(e) => setNewStudent(s => ({ ...s, year_level: e.target.value }))} />
                <input className={styles.search} placeholder="Contact number"
                  value={newStudent.contact_number}
                  onChange={(e) => setNewStudent(s => ({ ...s, contact_number: e.target.value }))} />
              </div>
            )}
          </div>

          <div className={styles.verifySection}>
            <h4 className={styles.verifySectionTitle}>Scholarship Award</h4>
            <div className={styles.verifyGrid}>
              <select className={styles.select} value={granteeScholarshipId}
                onChange={(e) => setGranteeScholarshipId(e.target.value)}>
                <option value="">Select scholarship *</option>
                {scholarshipsList.map(s => (
                  <option key={s.scholarship_id} value={s.scholarship_id}>
                    {s.scholarship_name}{s.status !== "Active" ? ` (${s.status})` : ""}
                  </option>
                ))}
              </select>
              <input className={styles.search} placeholder="Academic year, e.g. 2022-2023 *"
                value={granteeAcademicYear}
                onChange={(e) => setGranteeAcademicYear(e.target.value)} />
              <select className={styles.select} value={granteeSemester}
                onChange={(e) => setGranteeSemester(e.target.value)}>
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
              </select>
              <div>
                <label className={styles.verifyLabel}>Date awarded *</label><br />
                <input className={styles.search} type="date" value={granteeDateAwarded}
                  onChange={(e) => setGranteeDateAwarded(e.target.value)} />
              </div>
            </div>
            <p className={styles.description}>
              Date awarded anchors their payout schedule — enter their real original award date,
              not today's date, or the schedule will compute as if they just started.
            </p>

            <div className={styles.verifyGrid} style={{ marginTop: 10 }}>
              <div>
                <span className={styles.verifyLabel}>Current status</span>
                <div className={styles.verifyResultRow}>
                  {["Active", "Inactive", "Pending"].map(opt => (
                    <button key={opt} type="button"
                      className={`${styles.select} ${granteeStatus === opt ? styles.badge : ""}`}
                      onClick={() => setGranteeStatus(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={styles.verifyLabel}>Verification</span>
                <div className={styles.verifyResultRow}>
                  {["Verified", "Pending Review", "Ineligible"].map(opt => (
                    <button key={opt} type="button"
                      className={`${styles.select} ${granteeVerification === opt ? styles.badge : ""}`}
                      onClick={() => setGranteeVerification(opt)}>
                      {VERIFICATION_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.verifySection}>
            <h4 className={styles.verifySectionTitle}>Past Fund Releases (optional)</h4>
            <p className={styles.description}>
              Record any payouts already released before migration, so their schedule and totals
              reflect what's actually happened — otherwise every period will show as still due.
            </p>
            {releaseRows.map(r => (
              <div key={r.key} className={styles.verifyGrid} style={{ marginTop: 8, alignItems: "center" }}>
                <input className={styles.search} placeholder="Academic year"
                  value={r.academic_year}
                  onChange={(e) => updateReleaseRow(r.key, "academic_year", e.target.value)} />
                <select className={styles.select} value={r.semester}
                  onChange={(e) => updateReleaseRow(r.key, "semester", e.target.value)}>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                </select>
                <input className={styles.search} type="number" placeholder="Amount released"
                  value={r.amount_released}
                  onChange={(e) => updateReleaseRow(r.key, "amount_released", e.target.value)} />
                <input className={styles.search} type="date" value={r.release_date}
                  onChange={(e) => updateReleaseRow(r.key, "release_date", e.target.value)} />
                <select className={styles.select} value={r.status}
                  onChange={(e) => updateReleaseRow(r.key, "status", e.target.value)}>
                  <option value="Released">Released</option>
                  <option value="Skipped">Skipped</option>
                </select>
                <button type="button" className={styles.pageBtn} onClick={() => removeReleaseRow(r.key)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className={styles.pageBtn} style={{ marginTop: 10 }} onClick={addReleaseRow}>
              + Add a past release
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= IMPORT FROM FILE ================= */}
      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import Historical Grantees from File"
        size="lg"
        footer={
          importStep === "preview" ? (
            <>
              <button className={styles.pageBtn} onClick={() => setImportStep("upload")}>Back</button>
              <button
                className={styles.documentButton}
                disabled={importing || importReadyRows.length === 0}
                onClick={commitImport}
              >
                {importing ? "Importing…" : `Import ${importReadyRows.length} Ready Row${importReadyRows.length !== 1 ? "s" : ""}`}
              </button>
            </>
          ) : importStep === "results" ? (
            <button className={styles.documentButton} onClick={() => setShowImport(false)}>Done</button>
          ) : (
            <button className={styles.pageBtn} onClick={() => setShowImport(false)}>Cancel</button>
          )
        }
      >
        {importStep === "upload" && (
          <div className={styles.verifyForm}>
            <p className={styles.description}>
              For migrating many historical scholars at once instead of one at a time. Download the
              template, fill it in, and upload it — nothing gets saved until you've reviewed exactly
              what will happen on the next screen.
            </p>
            <div className={styles.verifySection}>
              <button type="button" className={styles.pageBtn} onClick={downloadCsvTemplate}>
                Download CSV Template
              </button>
              <p className={styles.description} style={{ marginTop: 10 }}>
                Required columns: first_name, last_name, school_id, scholarship_name, academic_year
                (e.g. 2022-2023), semester, date_awarded. scholarship_name must exactly match an
                existing scholarship's name. Optional: middle_name, course, year_level, contact_number,
                status (defaults Active), verification_result (defaults Verified).
              </p>
              <p className={styles.description}>
                If a school_id already exists in the system, that row links to the existing student
                instead of creating a new one — it never creates duplicate people.
              </p>
            </div>
            <div className={styles.verifySection}>
              <input type="file" accept=".csv" onChange={handleFileSelected} disabled={parsingFile} />
              {parsingFile && <p className={styles.description}>Reading and checking your file against current records…</p>}
            </div>
          </div>
        )}

        {importStep === "preview" && (
          <div className={styles.verifyForm}>
            <p className={styles.description}>
              <strong>{importFileName}</strong> — {importRows.length} row{importRows.length !== 1 ? "s" : ""} found.
              {" "}{importReadyRows.length} ready to import, {importRows.filter(r => r.errors.length > 0).length} will be skipped
              (fix and re-upload if needed), {importRows.filter(r => r.errors.length === 0 && r.warnings.length > 0).length} have warnings but will still import.
            </p>
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={styles.th}>Row</th>
                    <th className={styles.th}>Name</th>
                    <th className={styles.th}>School ID</th>
                    <th className={styles.th}>Scholarship</th>
                    <th className={styles.th}>AY / Semester</th>
                    <th className={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map(r => (
                    <tr key={r.rowNumber}>
                      <td className={styles.td}>{r.rowNumber}</td>
                      <td className={styles.td}>{r.first_name} {r.last_name}</td>
                      <td className={styles.td}>{r.school_id || "—"}</td>
                      <td className={styles.td}>{r.scholarship_name || "—"}</td>
                      <td className={styles.td}>{r.academic_year} {r.semester}</td>
                      <td className={styles.td}>
                        {r.errors.length > 0 ? (
                          <span style={{ color: "var(--danger-700)", fontWeight: 600 }}>
                            ✕ {r.errors.join("; ")}
                          </span>
                        ) : r.warnings.length > 0 ? (
                          <span style={{ color: "var(--warning-700)", fontWeight: 600 }}>
                            ⚠ {r.warnings.join("; ")}
                          </span>
                        ) : (
                          <span style={{ color: "var(--success-700)", fontWeight: 600 }}>✓ Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importStep === "results" && (
          <div className={styles.verifyForm}>
            <p className={styles.description}>
              <strong style={{ color: "var(--success-700)" }}>{importResults.succeeded}</strong> imported successfully.
              {importResults.failed.length > 0 && (
                <> <strong style={{ color: "var(--danger-700)" }}>{importResults.failed.length}</strong> failed during import.</>
              )}
            </p>
            {importResults.failed.length > 0 && (
              <div className={styles.verifySection}>
                <h4 className={styles.verifySectionTitle}>Failed rows</h4>
                {importResults.failed.map(f => (
                  <p key={f.row} className={styles.description}>
                    Row {f.row} ({f.name}): {f.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}