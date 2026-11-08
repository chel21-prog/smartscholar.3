import Icon from "@/components/ui/Icon";
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/ui/Modal";
import NumberInput from "@/components/ui/NumberInput";
import { useNavigate } from "react-router-dom";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import InfoTooltip from "@/components/ui/InfoTooltip";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { getCached, setCached, clearAllCached } from "@/lib/dataCache";
import { useToast } from "@/context/ToastContext";
import Button from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import { closePendingIfFull, fetchOccupiedMap } from "@/lib/scholarshipSlots";
import {
  endScholarship, notifyStudent, terminationText,
  revokeMessage, cancellationApprovedMessage, cancellationDeclinedMessage,
} from "@/lib/scholarshipCancellation";
import styles from "./Grantees.module.css";
import imp from "./GranteeImport.module.css";
import Stepper from "@/components/ui/Stepper";
import { SkeletonForm } from "@/components/ui/Skeleton";

const CACHE_KEY = "coordinator-grantees";

// The details a coordinator reviews when verifying a grantee. `get` reads the
// value from the fetched student profile (students row + joined users row).
const VERIFY_FIELDS = [
  { key: "name",           label: "Full name",       get: (p) => [p.users?.first_name, p.users?.middle_name, p.users?.last_name].filter(Boolean).join(" ") },
  { key: "school_id",      label: "School ID",       get: (p) => p.school_id },
  { key: "course",         label: "Program / course", get: (p) => p.course },
  { key: "year_level",     label: "Year level",      get: (p) => p.year_level },
  { key: "contact_number", label: "Contact number",  get: (p) => p.contact_number },
  { key: "email",          label: "Email",           get: (p) => p.users?.email },
  { key: "gender",         label: "Gender",          get: (p) => p.gender },
  { key: "ethnicity",      label: "Ethnicity",       get: (p) => p.ethnicity },
];
const hasVal = (v) => v !== null && v !== undefined && String(v).trim() !== "" && String(v) !== "N/A";

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

// A school year that has already finished (2022-2023 when it is now 2026) is history: those
// grantees must not occupy today's slots or show as a current scholarship. The Philippine
// school year starts around June.
const isPastAcademicYear = (ay) => {
  const m = /^(\d{4})\s*-\s*(\d{4})$/.exec((ay || "").trim());
  if (!m) return false;
  const now = new Date();
  const currentStart = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return Number(m[1]) < currentStart;
};

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
const [rowsPerPage] = useState(10);
  const [search,setSearch]=useState("");
  const [statusFilter, setStatusFilter] = useState("All");
const [scholarshipFilter, setScholarshipFilter] = useState("All");
const [semesterFilter, setSemesterFilter] = useState("All");
const [yearFilter, setYearFilter] = useState("All");
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── Revoke a scholarship / review a student's cancellation request ──
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeMessageText, setRevokeMessageText] = useState(null); // null = follow the default template
  const [savingRevoke, setSavingRevoke] = useState(false);
  const [cancelRequests, setCancelRequests] = useState([]);
  const [linkRequests, setLinkRequests] = useState([]); // students asking to be linked to an imported record
  const [linkBusy, setLinkBusy] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // { request, row }
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  // ── verification modal ────────────────────────────────────
  const [verifyTarget, setVerifyTarget] = useState(null); // the row being verified
  const [verifyProfile, setVerifyProfile] = useState(null);   // fresh students + users row for the modal
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [fieldChecks, setFieldChecks] = useState({});          // { [key]: "ok" | "update" }
  const [fieldNotes, setFieldNotes] = useState({});            // { [key]: "what is wrong" }
  const [notifyChoice, setNotifyChoice] = useState(null);   // null = follow the default (on when "Needs update")
  const [notifyMessage, setNotifyMessage] = useState(null);  // null = use the auto-written message
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
  const [importStep,     setImportStep]     = useState("upload"); // "upload" | "word" | "preview" | "results"
  const [importFileName, setImportFileName] = useState("");
  const [importRows,     setImportRows]     = useState([]); // parsed + validated
  const [parsingFile,    setParsingFile]    = useState(false);
  // Word (.docx) masterlist import: detected rows + the details the list doesn't carry
  const [wordDraft,      setWordDraft]      = useState(null);
  const wordPendingRef = useRef({}); // scholarships to create at import time: lower-cased name -> { name, amount }
  const [dragOver, setDragOver] = useState(false);
  const [previewFilter, setPreviewFilter] = useState("all"); // "all" | "ok" | "warn" | "bad"
  const [bulkSemester, setBulkSemester] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const wordRawRef = useRef([]); // the rows handed to validateImportRows, so a School ID typed in the preview can re-run it
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

    // a manual grant can use the last slot too
    if (granteeStatus === "Active") await closePendingIfFull(supabase, granteeScholarshipId);

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
  const downloadCsvTemplate = async () => {
    const { default: Papa } = await import("papaparse");
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
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (file) ingestFile(file);
  };

  const ingestFile = async (file) => {
    if (!/\.(csv|docx)$/i.test(file.name)) { toast.error("Choose a .docx or .csv file."); return; }
    setPreviewFilter("all");

    setImportFileName(file.name);
    setParsingFile(true);

    if (/\.docx$/i.test(file.name)) { await handleWordSelected(file); return; }

    const { default: Papa } = await import("papaparse");
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

  // ── Word (.docx) masterlist ────────────────────────────────
  // Recognises the columns by their headers (Last/First/MI, Program, Year, scholarship
  // column, ...), so small differences between lists still work. The list doesn't say
  // which semester, award date or school IDs, so those are asked for / filled in next.
  const handleWordSelected = async (file) => {
    try {
      const [{ readDocx }, { parseGranteeList, guessScholarship }] = await Promise.all([
        import("@/lib/docxTables"), import("@/lib/granteeList"),
      ]);
      const doc = await readDocx(await file.arrayBuffer());
      const parsed = parseGranteeList(doc.tables, doc.paragraphs, [file.name]);
      if (!parsed || parsed.rows.length === 0) {
        toast.error("Couldn't find a grantee list in that Word file. It needs a table with Last name and First name columns.");
        return;
      }
      const { data: sch } = await supabase.from("scholarships").select("scholarship_id, scholarship_name").order("scholarship_name");
      const counts = new Map();
      parsed.rows.forEach(r => counts.set(r.scholarship_label, (counts.get(r.scholarship_label) || 0) + 1));
      const usualAmount = (label) => {
        const tally = new Map();
        parsed.rows.filter(x => x.scholarship_label === label).forEach(x => {
          const n = Number(String(x.amount).replace(/[^\d.]/g, ""));
          if (n > 0) tally.set(n, (tally.get(n) || 0) + 1);
        });
        return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      };
      const labels = [...counts.entries()].map(([label, count]) => ({
        label, count, scholarship_id: String(guessScholarship(label, sch || [])?.scholarship_id || ""),
        newName: label, newAmount: String(usualAmount(label)),
      }));
      setWordDraft({
        rows: parsed.rows, skipped: parsed.skipped, scholarships: sch || [], labels,
        academic_year: parsed.academic_year, semester: parsed.semester,
        date_awarded: "",
        hasSchoolId: parsed.hasSchoolId,
      });
      setImportStep("word");
    } catch (err) {
      toast.error("Couldn't read that Word file: " + err.message);
    } finally {
      setParsingFile(false);
    }
  };

  const NEW_SCHOLARSHIP = "__new__";
  const wordLabelsMapped = wordDraft ? wordDraft.labels.filter(l => l.scholarship_id).reduce((n, l) => n + l.count, 0) : 0;

  // Semester and date awarded may be left blank here: they can be filled in per row
  // (or for all rows at once) on the next screen.
  const continueWordImport = async () => {
    const d = wordDraft;
    if (!AY_PATTERN.test(d.academic_year.trim())) return toast.error('Academic year should look like "2022-2023".');
    if (wordLabelsMapped === 0) return toast.error("Match at least one scholarship in the list to a scholarship in the system, or choose to create it.");
    const bad = d.labels.find(l => l.scholarship_id === NEW_SCHOLARSHIP && !l.newName.trim());
    if (bad) return toast.error("Give the new scholarship a name.");
    const nameById = new Map(d.scholarships.map(x => [String(x.scholarship_id), x.scholarship_name]));
    const pending = {};
    d.labels.filter(l => l.scholarship_id === NEW_SCHOLARSHIP).forEach(l => {
      pending[l.newName.trim().toLowerCase()] = { name: l.newName.trim(), amount: Number(l.newAmount) || 0 };
    });
    const nameFor = (l) => (l.scholarship_id === NEW_SCHOLARSHIP ? l.newName.trim() : nameById.get(l.scholarship_id));
    const byLabel = new Map(d.labels.map(l => [l.label, l]));
    const raw = d.rows
      .filter(row => byLabel.get(row.scholarship_label)?.scholarship_id)
      .map(row => ({
        first_name: row.first_name, middle_name: row.middle_name, last_name: row.last_name,
        school_id: row.school_id, course: row.course, year_level: row.year_level, contact_number: "",
        scholarship_name: nameFor(byLabel.get(row.scholarship_label)),
        academic_year: d.academic_year.trim(), semester: d.semester, date_awarded: d.date_awarded,
        status: "", verification_result: "",
      }));
    wordRawRef.current = raw;
    wordPendingRef.current = pending;
    setParsingFile(true);
    await validateImportRows(raw, { fromWord: true, pending });
    setParsingFile(false);
    setImportStep("preview");
  };

  const revalidateWord = () => validateImportRows(wordRawRef.current, { fromWord: true, pending: wordPendingRef.current });

  // One field on one row (School ID, semester, date awarded) typed into the preview.
  const setWordField = async (rawIndex, field, value) => {
    const v = String(value).trim();
    if (wordRawRef.current[rawIndex]?.[field] === v) return;
    wordRawRef.current = wordRawRef.current.map((row, i) => (i === rawIndex ? { ...row, [field]: v } : row));
    await revalidateWord();
  };

  // Semester / date awarded for every row at once (only the fields that were filled in).
  const applyToAllWord = async (patch) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v));
    if (Object.keys(clean).length === 0) return toast.error("Choose a semester or a date first.");
    wordRawRef.current = wordRawRef.current.map(row => ({ ...row, ...clean }));
    await revalidateWord();
  };

  // The previewed rows as the CSV template, so missing School IDs can be filled in a spreadsheet.
  const downloadPreviewCsv = async () => {
    const { default: Papa } = await import("papaparse");
    const csv = Papa.unparse({
      fields: CSV_COLUMNS,
      data: importRows.map(r => CSV_COLUMNS.map(c => (c === "year_level" ? (r.year_level ?? "") : (r[c] ?? "")))),
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = "grantees_from_word.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const validateImportRows = async (rawIn, opts = {}) => {
    // Rows without a School ID (a Word masterlist has none): look for exactly one existing
    // student with the same first and last name and use theirs.
    const nameFilled = new Set();
    let raw = rawIn;
    const noId = rawIn.filter(x => !(x.school_id || "").trim());
    if (noId.length > 0) {
      const lastNames = [...new Set(noId.map(x => (x.last_name || "").trim()).filter(Boolean))];
      const { data: byName } = lastNames.length > 0
        ? await supabase.from("students").select("school_id, users!inner(first_name, last_name)").in("users.last_name", lastNames)
        : { data: [] };
      const key = (f, l) => `${(f || "").trim().toLowerCase()}|${(l || "").trim().toLowerCase()}`;
      const idx = new Map();
      (byName || []).forEach(st => {
        const k = key(st.users?.first_name, st.users?.last_name);
        idx.set(k, [...(idx.get(k) || []), st.school_id]);
      });
      raw = rawIn.map((x, i) => {
        if ((x.school_id || "").trim()) return x;
        const hit = idx.get(key(x.first_name, x.last_name)) || [];
        if (hit.length === 1) { nameFilled.add(i); return { ...x, school_id: hit[0] }; }
        return x;
      });
    }

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

      const pastYear = isPastAcademicYear(academic_year);
      const status = r.status?.trim() ? normalizeAgainst(r.status, VALID_STATUSES) : (pastYear ? "Inactive" : "Active");
      if (r.status?.trim() && !status) errors.push(`status "${r.status}" must be Active, Inactive, or Pending`);
      if (!r.status?.trim() && pastYear) warnings.push(`${academic_year} is a past school year, so this is saved as Inactive (history only). It won't use up a slot or show as a current scholarship`);
      if (r.status?.trim() && status === "Active" && pastYear) warnings.push(`${academic_year} is a past school year but the status is Active. This will use up a slot`);

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

      const pendingNew = opts.pending?.[scholarship_name.toLowerCase()];
      const scholarshipMatch = scholarship_name ? scholarshipByName.get(scholarship_name.toLowerCase()) : null;
      if (pendingNew && !scholarshipMatch) warnings.push(`Will create the scholarship "${pendingNew.name}" (set to Suspended until you set it up under Scholarships)`);
      if (scholarship_name && !scholarshipMatch && !pendingNew) errors.push(`No scholarship named "${scholarship_name}" — check spelling, or add it under Scholarships first`);

      const studentMatch = school_id ? studentBySchoolId.get(school_id) : null;
      if (nameFilled.has(i)) warnings.push("School ID filled in from an existing student with the same name. Check it is the same person");
      if (studentMatch) {
        warnings.push(`School ID already in the system — will link to ${studentMatch.users?.first_name} ${studentMatch.users?.last_name} instead of creating a new student`);
        const dupeGrant = (studentMatch.existingGrantees || []).some(g =>
          scholarshipMatch && g.scholarship_id === scholarshipMatch.scholarship_id &&
          g.academic_year === academic_year && g.semester === semester
        );
        if (dupeGrant) errors.push("This student already has a grantee record for this exact scholarship, academic year and semester. It won't be imported again");
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
        scholarship_name, scholarship_id: scholarshipMatch?.scholarship_id || null, newScholarship: pendingNew && !scholarshipMatch ? pendingNew : null,
        academic_year, semester: semester || r.semester?.trim() || "",
        date_awarded, status: status || "Active", verification_result: verification_result || "Verified",
        studentMatch,
        fromWord: Boolean(opts.fromWord), rawIndex: i,
        errors, warnings,
      };
    });

    setImportRows(validated);
  };

  const importReadyRows = importRows.filter(r => r.errors.length === 0);
  const badRows   = importRows.filter(r => r.errors.length > 0);
  const warnRows  = importRows.filter(r => r.errors.length === 0 && r.warnings.length > 0);
  const cleanRows = importRows.filter(r => r.errors.length === 0 && r.warnings.length === 0);
  const noIdCount = importRows.filter(r => !r.school_id).length;
  const shownRows = previewFilter === "ok" ? cleanRows : previewFilter === "warn" ? warnRows : previewFilter === "bad" ? badRows : importRows;
  const isWordImport = importStep === "word" || Boolean(importRows[0]?.fromWord);
  const importSteps = isWordImport
    ? [{ id: "upload", label: "Upload" }, { id: "details", label: "Details" }, { id: "review", label: "Review", count: importStep === "preview" ? importReadyRows.length : 0 }, { id: "done", label: "Done" }]
    : [{ id: "upload", label: "Upload" }, { id: "review", label: "Review", count: importStep === "preview" ? importReadyRows.length : 0 }, { id: "done", label: "Done" }];
  const importStepId = { upload: "upload", word: "details", preview: "review", results: "done" }[importStep];

  const commitImport = async () => {
    if (importReadyRows.length === 0) return;
    setImporting(true);

    const succeeded = [];
    const failed = [];
    const touchedScholarships = new Set();

    // Scholarships that don't exist yet are created first. They start as Suspended so
    // students can't apply to a half-set-up scholarship; set them up under Scholarships.
    const createdIds = new Map(); // lower-cased name -> scholarship_id
    for (const row of importReadyRows) {
      const ns = row.newScholarship;
      if (!ns || createdIds.has(ns.name.toLowerCase())) continue;
      const { data: made, error: madeErr } = await supabase.from("scholarships").insert({
        scholarship_name: ns.name, amount: ns.amount, total_budget: 0, slots: 0,
        submission_deadline: row.date_awarded || new Date().toISOString().split("T")[0],
        payout_frequency: "Semester", duration_type: "Until Graduation", status: "Suspended",
        description: "Created while importing a grantee list. Review its details, requirements and application form, then set it to Active.",
      }).select().single();
      if (madeErr) {
        toast.error(`Couldn't create the scholarship "${ns.name}": ${madeErr.message}. Nothing was imported.`);
        setImporting(false);
        return;
      }
      createdIds.set(ns.name.toLowerCase(), made.scholarship_id);
    }
    importReadyRows.forEach(row => {
      if (row.newScholarship) row.scholarship_id = createdIds.get(row.newScholarship.name.toLowerCase());
    });

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
      if (row.status === "Active") touchedScholarships.add(row.scholarship_id);
    }

    for (const sid of touchedScholarships) await closePendingIfFull(supabase, sid);

    // Tell the coordinator if the imported Active grantees put a scholarship over its slot limit.
    if (touchedScholarships.size > 0) {
      const [{ data: limits }, occupiedNow] = await Promise.all([
        supabase.from("scholarships").select("scholarship_id, scholarship_name, slots").in("scholarship_id", [...touchedScholarships]),
        fetchOccupiedMap(supabase),
      ]);
      const over = (limits || []).filter(sc => Number(sc.slots) > 0 && (occupiedNow[String(sc.scholarship_id)] || 0) > Number(sc.slots));
      if (over.length > 0) {
        toast.error(
          over.map(sc => `${sc.scholarship_name}: ${occupiedNow[String(sc.scholarship_id)]} active grantees but only ${sc.slots} slots`).join(". ") +
          ". Raise the slots under Scholarships if that's right.",
          12000
        );
      }
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
        user_id,
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
      student_id: g.student_id,
      student_user_id: g.students?.user_id ?? null,
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
  loadRequests();
  loadLinkRequests();
};

  // Pending cancellation requests from students. If the table doesn't exist yet
  // (supabase/scholarship_cancellation.sql not run) this just shows no requests.
  const loadRequests = async () => {
    const { data, error } = await supabase
      .from("scholarship_cancellation_requests")
      .select("request_id, grantee_id, student_id, reason, status, created_at")
      .eq("status", "Pending")
      .order("created_at", { ascending: true });
    setCancelRequests(error ? [] : data || []);
  };

  // Students who typed a School ID that matches an imported record. Needs
  // supabase/claim_imported_student.sql; if it isn't installed this shows nothing.
  const loadLinkRequests = async () => {
    const { data, error } = await supabase.rpc("list_student_link_requests");
    setLinkRequests(error ? [] : data || []);
  };

  const decideLink = async (rq, approve) => {
    if (linkBusy) return;
    if (!approve && !window.confirm("Reject this link request? The imported record stays as it is.")) return;
    setLinkBusy(rq.request_id);
    const { data, error } = approve
      ? await supabase.rpc("approve_student_link", { p_request_id: rq.request_id })
      : await supabase.rpc("reject_student_link", { p_request_id: rq.request_id, p_remarks: null });
    setLinkBusy(null);
    if (error) return toast.error(error.message);
    if (approve && !data?.approved) {
      toast.error(data?.reason === "already_claimed" ? "That record was already linked to an account." : "Couldn't link this one. It may no longer exist.");
    } else if (!approve && !data?.rejected) {
      toast.error("That request was already handled.");
    } else {
      toast.success(approve ? "Linked. The scholarship now shows on the student's account." : "Request rejected.");
      notifyStudent(
        supabase,
        data?.student_user_id,
        approve ? "Scholarship records linked" : "Link request not approved",
        approve
          ? "A coordinator confirmed your School ID. Your past scholarship records are now on your account."
          : "A coordinator could not confirm that the School ID you entered is yours. Please check it, or visit the scholarship office."
      );
    }
    clearAllCached();
    load();
  };

  const pendingGranteeIds = new Set(cancelRequests.map((r) => String(r.grantee_id)));

  const openRevoke = (row) => {
    setRevokeTarget(row);
    setRevokeReason("");
    setRevokeMessageText(null);
  };
  const closeRevoke = () => { if (!savingRevoke) setRevokeTarget(null); };
  const revokeText = revokeMessageText ?? (revokeTarget ? revokeMessage(revokeTarget.scholarship_name, revokeReason) : "");

  const submitRevoke = async () => {
    if (!revokeTarget || savingRevoke) return;
    if (!revokeReason.trim()) return toast.error("Enter a reason before revoking this scholarship.");
    if (!revokeText.trim()) return toast.error("Write the message the student will receive.");

    setSavingRevoke(true);
    const { error } = await endScholarship(supabase, {
      grantee: revokeTarget,
      reasonText: terminationText("revoke", revokeReason),
      verifiedBy: currentUserId,
    });
    if (error) {
      toast.error(error.message);
      setSavingRevoke(false);
      return;
    }

    // a pending cancellation request for this same scholarship is now moot
    await supabase
      .from("scholarship_cancellation_requests")
      .update({
        status: "Approved",
        coordinator_remarks: "The scholarship was revoked by the coordinator.",
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("grantee_id", revokeTarget.grantee_id)
      .eq("status", "Pending");

    const notified = await notifyStudent(supabase, revokeTarget.student_user_id, "Your scholarship was revoked", revokeText);
    if (notified) toast.success("Scholarship revoked and the student was notified.");
    else toast.error("Scholarship revoked, but the student could not be notified.");

    setSavingRevoke(false);
    setRevokeTarget(null);
    load();
  };

  const openReview = (request) => {
    const row = rows.find((r) => String(r.grantee_id) === String(request.grantee_id)) || null;
    setReviewTarget({ request, row });
    setReviewRemarks("");
  };
  const closeReview = () => { if (!savingReview) setReviewTarget(null); };

  const submitReview = async (decision) => {
    if (!reviewTarget || savingReview) return;
    const { request, row } = reviewTarget;
    if (decision === "Declined" && !reviewRemarks.trim()) {
      return toast.error("Tell the student why the request was declined.");
    }
    if (decision === "Approved" && !row) {
      return toast.error("Couldn't find that scholarship award. Refresh the page and try again.");
    }

    setSavingReview(true);

    if (decision === "Approved") {
      const { error } = await endScholarship(supabase, {
        grantee: row,
        reasonText: terminationText("cancel", request.reason),
        verifiedBy: currentUserId,
      });
      if (error) {
        toast.error(error.message);
        setSavingReview(false);
        return;
      }
    }

    const { error: requestError } = await supabase
      .from("scholarship_cancellation_requests")
      .update({
        status: decision,
        coordinator_remarks: reviewRemarks.trim() || null,
        reviewed_by: currentUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("request_id", request.request_id);
    if (requestError) toast.error(requestError.message);

    const name = row?.scholarship_name || "scholarship";
    const approved = decision === "Approved";
    const notified = await notifyStudent(
      supabase,
      row?.student_user_id,
      approved ? "Scholarship cancellation approved" : "Scholarship cancellation declined",
      approved ? cancellationApprovedMessage(name, reviewRemarks) : cancellationDeclinedMessage(name, reviewRemarks)
    );
    if (notified) toast.success(approved ? "Scholarship ended and the student was notified." : "Request declined and the student was notified.");
    else toast.error("Saved, but the student could not be notified.");

    setSavingReview(false);
    setReviewTarget(null);
    load();
  };

  const openVerify = async (row) => {
    setVerifyTarget(row);
    setVerifyRemarks("");
    setVerifyResult("");
    setTerminationReason("");
    setFieldChecks({});
    setFieldNotes({});
    setNotifyChoice(null);
    setNotifyMessage(null);
    setVerifyProfile(null);
    setVerifyLoading(true);

    // Pull the student's CURRENT profile so the coordinator reviews live data,
    // not whatever the grantees list cached.
    const { data } = await supabase
      .from("students")
      .select("user_id, school_id, course, year_level, gender, ethnicity, contact_number, users(first_name, middle_name, last_name, email)")
      .eq("student_id", row.student_id)
      .maybeSingle();

    const profile = data || {
      school_id: row.school_id,
      course: row.course,
      year_level: row.year_level,
      users: { first_name: row.student_name },
    };
    setVerifyProfile(profile);

    // anything the student never filled in is flagged automatically
    const auto = {};
    const notes = {};
    VERIFY_FIELDS.forEach((f) => {
      if (!hasVal(f.get(profile))) { auto[f.key] = "update"; notes[f.key] = "Missing"; }
    });
    setFieldChecks(auto);
    setFieldNotes(notes);
    setVerifyLoading(false);
  };

  const closeVerify = () => setVerifyTarget(null);

  // ── notify-the-student helpers (used by the modal and by submitVerification) ──
  const verifyFlagged = VERIFY_FIELDS.filter((f) => fieldChecks[f.key] === "update");
  const canNotify =
    !!verifyTarget && verifyFlagged.length > 0 && (verifyResult === "Mismatch" || verifyResult === "Eligible");
  const willNotify = canNotify && (notifyChoice ?? verifyResult === "Mismatch");
  const notifyDefaultMessage = (() => {
    if (!verifyTarget) return "";
    const first = verifyProfile?.users?.first_name || verifyTarget.student_name || "there";
    const lines = verifyFlagged.map((f) =>
      fieldNotes[f.key]?.trim() ? `• ${f.label} — ${fieldNotes[f.key].trim()}` : `• ${f.label}`
    );
    return (
      `Hi ${first}, we reviewed your information for your ${verifyTarget.scholarship_name} grant ` +
      `(${verifyTarget.academic_year} · ${verifyTarget.semester}) and found details that need updating:\n\n` +
      `${lines.join("\n")}\n\n` +
      `Please update them in your profile as soon as you can so your scholarship stays in good standing.`
    );
  })();
  const notifyText = notifyMessage ?? notifyDefaultMessage;

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

    // Record exactly what was reviewed so the history shows why it was judged this way.
    const flagged = VERIFY_FIELDS.filter((f) => fieldChecks[f.key] === "update");
    const okCount = VERIFY_FIELDS.filter((f) => fieldChecks[f.key] === "ok").length;
    const summary = flagged.length
      ? `Info check: ${okCount}/${VERIFY_FIELDS.length} accurate. Needs update: ${flagged
          .map((f) => (fieldNotes[f.key]?.trim() ? `${f.label} (${fieldNotes[f.key].trim()})` : f.label))
          .join("; ")}.`
      : `Info check: ${okCount}/${VERIFY_FIELDS.length} accurate.`;
    const remarks = [summary, verifyRemarks.trim()].filter(Boolean).join(" ");

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

    // Tell the student what to fix. Tries a dedicated "Profile Update" type
    // (clicking it opens their profile); if the notifications table only
    // accepts its older types, falls back to "Other" so it still gets sent.
    let notified = false;
    if (willNotify && verifyProfile?.user_id && notifyText.trim()) {
      const base = {
        user_id: verifyProfile.user_id,
        title: "Action needed: update your information",
        message: notifyText.trim(),
        is_read: false,
      };
      let { error: notifError } = await supabase
        .from("notifications")
        .insert({ ...base, notification_type: "Profile Update" });
      if (notifError) {
        ({ error: notifError } = await supabase
          .from("notifications")
          .insert({ ...base, notification_type: "Other" }));
      }
      if (notifError) {
        toast.error("Verification saved, but the student could not be notified: " + notifError.message);
      } else {
        notified = true;
      }
    }
    if (notified) toast.success("Verification saved and the student was notified.");

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
    <div className={`page-shell ${styles.page}`}>
      <div className={`page-header ${styles.header}`}>
    <div>
        <h1 className="page-title">
            Scholarship Grantees
        </h1>

        <p className="page-subtitle">
            View all approved scholarship recipients and their submitted requirements.
        </p>
    </div>
    <div className={styles.headerActions}>
      <Button variant="primary" onClick={openAddGrantee}>
        + Add Historical Grantee
      </Button>
      <Button variant="primary" onClick={openImport}>
        Import from File
      </Button>
      <Button
        variant="secondary"
        onClick={() => navigate("/coordinator/dashboard", { state: { openReport: { type: "grantees", returnTo: "/coordinator/grantees" } } })}
      >
        Generate Report
      </Button>
    </div>
</div>
    
    <div className={`stats-grid ${styles.statsRow}`}>
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

{cancelRequests.length > 0 && (
  <section className={styles.requestsPanel} aria-label="Cancellation requests">
    <h2 className={styles.requestsTitle}>
      Cancellation requests <span className={styles.requestsCount}>{cancelRequests.length}</span>
    </h2>
    <div className={styles.requestsList}>
      {cancelRequests.map((rq) => {
        const row = rows.find((r) => String(r.grantee_id) === String(rq.grantee_id));
        return (
          <div key={rq.request_id} className={styles.requestRow}>
            <div className={styles.requestMain}>
              <strong>{row?.student_name || "Unknown student"}</strong>
              <span className={styles.requestMeta}>
                {row?.scholarship_name || "Scholarship"} · requested {rq.created_at ? new Date(rq.created_at).toLocaleDateString() : "recently"}
              </span>
              <span className={styles.requestReason}>{rq.reason}</span>
            </div>
            <Button size="sm" variant="primary" onClick={() => openReview(rq)}>Review</Button>
          </div>
        );
      })}
    </div>
  </section>
)}

{linkRequests.length > 0 && (
  <section className={styles.requestsPanel} aria-label="Account link requests">
    <h2 className={styles.requestsTitle}>
      Account link requests <span className={styles.requestsCount}>{linkRequests.length}</span>
    </h2>
    <div className={styles.requestsList}>
      {linkRequests.map((rq) => (
        <div key={rq.request_id} className={styles.requestRow}>
          <div className={styles.requestMain}>
            <strong>{rq.requester_name || "Student"}</strong>
            <span className={styles.requestMeta}>
              entered School ID {rq.school_id}{rq.requester_email ? ` · ${rq.requester_email}` : ""}
            </span>
            <span className={styles.requestReason}>
              Imported record: {rq.imported_name}{rq.imported_course ? ` · ${rq.imported_course}` : ""}{rq.scholarships ? ` · ${rq.scholarships}` : ""}. Approve only if you can confirm this is the same person.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant="secondary" disabled={linkBusy === rq.request_id} onClick={() => decideLink(rq, false)}>Reject</Button>
            <Button size="sm" variant="primary" disabled={linkBusy === rq.request_id} onClick={() => decideLink(rq, true)}>Approve</Button>
          </div>
        </div>
      ))}
    </div>
  </section>
)}

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
              <th data-pin className={styles.th}>Student Name</th>
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

<td data-pin className={styles.td}>
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
            className={`${styles.statusText} ${
              s.status === "Active"
                ? styles.active
                : styles.inactive
            }`}
          >
            {s.status}
          </span>
          {pendingGranteeIds.has(String(s.grantee_id)) && (
            <span className={styles.requestChip}>Cancel requested</span>
          )}
        </td>

        <td className={styles.td}>
  <span
    className={`${styles.statusText} ${
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
  <div className={styles.rowActions}>
    <Button size="sm" variant={s.verification_result === "Verified" ? "secondary" : "primary"} onClick={() => openVerify(s)}>
      {s.verification_result === "Verified" ? "Re-verify" : "Verify"}
    </Button>
    {s.status === "Active" && (
      <Button size="sm" variant="danger" onClick={() => openRevoke(s)}>Revoke</Button>
    )}
  </div>
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
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeVerify}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!verifyResult || savingVerification}
              onClick={submitVerification}
            >
              {savingVerification ? "Saving…" : willNotify ? "Save & notify" : "Save"}
            </Button>
          </>
        }
      >
        {verifyTarget && (() => {
          const initial = (verifyTarget.student_name || "?").trim().charAt(0).toUpperCase() || "?";
          const total = VERIFY_FIELDS.length;
          const okCount = VERIFY_FIELDS.filter((f) => fieldChecks[f.key] === "ok").length;
          const flaggedCount = VERIFY_FIELDS.filter((f) => fieldChecks[f.key] === "update").length;
          const reviewed = okCount + flaggedCount;
          const suggested = flaggedCount > 0 ? "Mismatch" : reviewed === total ? "Eligible" : null;
          const lastVerified = verifyTarget.last_verified_at
            ? new Date(verifyTarget.last_verified_at).toLocaleDateString()
            : null;
          const setCheck = (key, val) => setFieldChecks((c) => ({ ...c, [key]: val }));
          const choices = [
            { id: "Eligible",   label: "Verified",     cls: styles.vfEligible,   icon: <Icon name="check" size={14} />, desc: "Information is accurate and up to date." },
            { id: "Mismatch",   label: "Needs update", cls: styles.vfMismatch,   icon: "!", desc: "Something is wrong or outdated — hold at Pending Review." },
            { id: "Ineligible", label: "Ineligible",   cls: styles.vfIneligible, icon: <Icon name="close" size={14} />, desc: "No longer qualifies — deactivate the grant." },
          ];
          return (
            <div className={styles.vfWrap}>
              {/* who / what is being verified */}
              <div className={styles.vfWho}>
                <div className={styles.vfAvatar} aria-hidden="true">{initial}</div>
                <div className={styles.vfWhoText}>
                  <h3 className={styles.vfName}>{verifyTarget.student_name}</h3>
                  <p className={styles.vfMeta}>
                    {lastVerified ? `Last verified ${lastVerified}` : "Never verified"}
                  </p>
                  <div className={styles.vfChips}>
                    <span className={styles.vfChip}>{verifyTarget.scholarship_name}</span>
                    <span className={styles.vfChip}>{verifyTarget.academic_year}</span>
                    <span className={styles.vfChip}>{verifyTarget.semester}</span>
                  </div>
                </div>
              </div>

              {/* 1 · review the student's information */}
              <section className={styles.vfCard}>
                <div className={styles.vfCardHead}>
                  <div>
                    <h3 className={styles.vfCardTitle}>1 · Review student information</h3>
                    <p className={styles.vfHint}>Check each detail. Flag anything that is wrong, missing or out of date.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={verifyLoading}
                    onClick={() =>
                      setFieldChecks((c) => {
                        const next = { ...c };
                        VERIFY_FIELDS.forEach((f) => {
                          if (next[f.key] !== "update") next[f.key] = "ok";
                        });
                        return next;
                      })
                    }
                  >
                    Mark all accurate
                  </Button>
                </div>

                <div className={styles.vfProgress} aria-hidden="true">
                  <div className={styles.vfProgressBar} style={{ width: `${(reviewed / total) * 100}%` }} />
                </div>
                <p className={styles.vfProgressText}>
                  {reviewed} of {total} reviewed{flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
                </p>

                {verifyLoading || !verifyProfile ? (
                  <SkeletonForm fields={5} />
                ) : (
                  <div className={styles.vfRows}>
                    {VERIFY_FIELDS.map((f) => {
                      const val = f.get(verifyProfile);
                      const check = fieldChecks[f.key];
                      return (
                        <div key={f.key} className={`${styles.vfRow} ${check === "update" ? styles.vfRowFlag : ""}`}>
                          <div className={styles.vfRowMain}>
                            <div className={styles.vfRowInfo}>
                              <span className={styles.vfRowLabel}>{f.label}</span>
                              <span className={hasVal(val) ? styles.vfRowVal : styles.vfRowMissing}>
                                {hasVal(val) ? val : "Not provided"}
                              </span>
                            </div>
                            <div className={styles.vfSeg} role="radiogroup" aria-label={`${f.label} check`}>
                              <button
                                type="button" role="radio" aria-checked={check === "ok"} data-plain-hover=""
                                className={`${styles.vfSegBtn} ${check === "ok" ? styles.vfSegOk : ""}`}
                                onClick={() => setCheck(f.key, "ok")}
                              >
                                Accurate
                              </button>
                              <button
                                type="button" role="radio" aria-checked={check === "update"} data-plain-hover=""
                                className={`${styles.vfSegBtn} ${check === "update" ? styles.vfSegBad : ""}`}
                                onClick={() => setCheck(f.key, "update")}
                              >
                                Needs update
                              </button>
                            </div>
                          </div>
                          {check === "update" && (
                            <input
                              className={styles.vfInput}
                              placeholder="What is wrong or needs changing? (optional)"
                              value={fieldNotes[f.key] || ""}
                              onChange={(e) => setFieldNotes((n) => ({ ...n, [f.key]: e.target.value }))}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 2 · verification status */}
              <section className={styles.vfCard}>
                <div>
                  <h3 className={styles.vfCardTitle}>2 · Verification status <span className={styles.vfReq}>*</span></h3>
                  <p className={styles.vfHint}>
                    {suggested
                      ? "Based on your review, we suggest the option marked below — you make the final call."
                      : "Finish reviewing the information above and we will suggest a status."}
                  </p>
                </div>
                <div className={styles.vfChoices} role="radiogroup" aria-label="Verification status">
                  {choices.map((c) => {
                    const on = verifyResult === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`${styles.vfChoice} ${c.cls} ${on ? styles.vfOn : ""}`}
                        onClick={() => setVerifyResult(c.id)}
                      >
                        <span className={styles.vfChoiceTop}>
                          <span className={styles.vfChoiceIcon}>{c.icon}</span>
                          {suggested === c.id && <span className={styles.vfSuggested}>Suggested</span>}
                        </span>
                        <span className={styles.vfChoiceTitle}>{c.label}</span>
                        <span className={styles.vfChoiceDesc}>{c.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {verifyResult === "Eligible" && flaggedCount > 0 && (
                  <p className={styles.vfNote}>
                    {flaggedCount} detail{flaggedCount === 1 ? " is" : "s are"} flagged as needing an update. Mark the grantee
                    Verified only if that's intentional.
                  </p>
                )}

                {verifyResult === "Mismatch" && (
                  <p className={styles.vfNote}>
                    This keeps the grantee at Pending Review until their information is corrected and checked again.
                  </p>
                )}

                {verifyResult === "Ineligible" && (
                  <div className={styles.vfField}>
                    <label className={styles.vfLabel}>Reason <span className={styles.vfReq}>*</span></label>
                    <select
                      className={styles.vfInput}
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
                  </div>
                )}

                {canNotify && (
                  <div className={styles.vfNotify}>
                    <label className={styles.vfNotifyHead}>
                      <input
                        type="checkbox"
                        checked={willNotify}
                        onChange={(e) => setNotifyChoice(e.target.checked)}
                      />
                      <span>
                        <strong>Notify the student</strong>
                        <span className={styles.vfHint}> — sends a notification asking them to fix the flagged details.</span>
                      </span>
                    </label>
                    {willNotify && (
                      <>
                        <textarea
                          className={`${styles.vfInput} ${styles.vfTextarea}`}
                          rows={6}
                          value={notifyText}
                          onChange={(e) => setNotifyMessage(e.target.value)}
                          aria-label="Message to the student"
                        />
                        {notifyMessage !== null && (
                          <button type="button" className={styles.vfLinkBtn} data-plain-hover="" onClick={() => setNotifyMessage(null)}>
                            Reset to suggested message
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className={styles.vfField}>
                  <label className={styles.vfLabel}>Remarks (optional)</label>
                  <textarea
                    className={`${styles.vfInput} ${styles.vfTextarea}`}
                    placeholder="Anything worth noting for the next verification…"
                    rows={2}
                    value={verifyRemarks}
                    onChange={(e) => setVerifyRemarks(e.target.value)}
                  />
                </div>
              </section>
            </div>
          );
        })()}
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
                <NumberInput className={styles.search} min={1} placeholder="Year level"
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
                <NumberInput className={styles.search} min={0} placeholder="Amount released"
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
        size="xl"
        footer={
          importStep === "word" ? (
            <>
              <button className={styles.pageBtn} onClick={() => setImportStep("upload")}>Back</button>
              <button className={styles.documentButton} disabled={parsingFile} onClick={continueWordImport}>
                {parsingFile ? "Checking…" : "Continue"}
              </button>
            </>
          ) : importStep === "preview" ? (
            <>
              <button className={styles.pageBtn} onClick={() => setImportStep(wordDraft && importRows[0]?.fromWord ? "word" : "upload")}>Back</button>
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
        <div className={imp.stepper}>
          <Stepper steps={importSteps} current={importStepId} onStep={() => {}} canVisit={() => false} />
        </div>

        {importStep === "upload" && (
          <div>
            <label
              className={`${imp.drop} ${dragOver ? imp.dropActive : ""} ${parsingFile ? imp.dropBusy : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) ingestFile(f); }}
            >
              <input className={imp.dropInput} type="file" accept=".csv,.docx" onChange={handleFileSelected} disabled={parsingFile} />
              <span className={imp.dropIcon} aria-hidden="true"><Icon name="upload" size={20} /></span>
              <span className={imp.dropTitle}>{parsingFile ? "Reading and checking your file…" : "Drop a file here, or click to choose"}</span>
              <span className={imp.dropSub}>Word masterlist (.docx) or CSV (.csv)</span>
            </label>

            <div className={imp.kinds}>
              <div className={imp.kind}>
                <span className={imp.kindTitle}><Icon name="file" size={14} /> Word masterlist</span>
                <p className={imp.kindText}>
                  Columns are recognised by their headers (Last, First, MI, Program, Year, scholarship). You'll be asked
                  for anything the list doesn't say, like the semester.
                </p>
              </div>
              <div className={imp.kind}>
                <span className={imp.kindTitle}><Icon name="file" size={14} /> CSV template</span>
                <div className={imp.chips}>
                  {["first_name", "last_name", "school_id", "scholarship_name", "academic_year", "semester", "date_awarded"].map(c => <span key={c} className={imp.chip}>{c}</span>)}
                  {["middle_name", "course", "year_level", "contact_number", "status", "verification_result"].map(c => <span key={c} className={`${imp.chip} ${imp.chipOpt}`}>{c}</span>)}
                </div>
                <p className={imp.kindText}>Solid chips are required. scholarship_name must match an existing scholarship.</p>
                <div><button type="button" className={styles.pageBtn} onClick={downloadCsvTemplate}>Download CSV template</button></div>
              </div>
            </div>

            <p className={imp.note}>
              Nothing is saved until you've reviewed every row on the next screens. A School ID already in the system links to that
              student instead of creating a new person. Rows from school years that have already ended are saved as Inactive,
              so they don't use up current slots.
            </p>
          </div>
        )}

        {importStep === "word" && wordDraft && (
          <div>
            <div className={imp.fileBar}>
              <span className={imp.dropIcon} aria-hidden="true" style={{ width: 36, height: 36, fontSize: 16 }}><Icon name="file" size={16} /></span>
              <div>
                <div className={imp.fileName}>{importFileName}</div>
                <div className={imp.fileMeta}>
                  {wordDraft.rows.length} grantees found
                  {wordDraft.skipped > 0 && <> · {wordDraft.skipped} blank or incomplete rows skipped</>}
                </div>
              </div>
            </div>

            <section className={imp.card}>
              <h4 className={imp.cardTitle}>About this list</h4>
              <p className={imp.cardHint}>Applies to every row. Semester and date can be left blank here and set per row on the review screen.</p>
              <div className={imp.grid3}>
                <label className={imp.label}>Academic year
                  <input className={styles.vfInput} value={wordDraft.academic_year} placeholder="2022-2023"
                    onChange={(e) => setWordDraft(d => ({ ...d, academic_year: e.target.value }))} />
                </label>
                <label className={imp.label}><span>Semester <span className={imp.optional}>(optional)</span></span>
                  <select className={styles.vfInput} value={wordDraft.semester}
                    onChange={(e) => setWordDraft(d => ({ ...d, semester: e.target.value }))}>
                    <option value="">Set later</option>
                    {VALID_SEMESTERS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className={imp.label}><span>Date awarded <span className={imp.optional}>(optional)</span></span>
                  <input className={styles.vfInput} type="date" value={wordDraft.date_awarded}
                    onChange={(e) => setWordDraft(d => ({ ...d, date_awarded: e.target.value }))} />
                </label>
              </div>
            </section>

            <section className={imp.card}>
              <h4 className={imp.cardTitle}>Match scholarships</h4>
              <p className={imp.cardHint}>Pick the scholarship in the system for each name in the list, create it if it isn't there yet, or skip those people.</p>
              {wordDraft.labels.map((l, i) => {
                const upd = (patch) => setWordDraft(d => ({ ...d, labels: d.labels.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                const kind = l.scholarship_id === NEW_SCHOLARSHIP ? "new" : l.scholarship_id ? "ok" : "skip";
                return (
                  <div key={l.label || "none"} className={imp.match}>
                    <div className={imp.matchTop}>
                      <span className={imp.matchName}>
                        <strong>{l.label || "(no scholarship column)"}</strong>
                        <span className={imp.matchCount}>{l.count} grantee{l.count !== 1 ? "s" : ""}</span>
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select className={styles.vfInput} style={{ flex: 1 }} value={l.scholarship_id} aria-label={`Scholarship for ${l.label}`}
                          onChange={(e) => upd({ scholarship_id: e.target.value })}>
                          <option value="">Skip these</option>
                          <option value={NEW_SCHOLARSHIP}>+ Create new scholarship…</option>
                          {wordDraft.scholarships.map(sc => <option key={sc.scholarship_id} value={String(sc.scholarship_id)}>{sc.scholarship_name}</option>)}
                        </select>
                        <span className={`${imp.tag} ${kind === "ok" ? imp.tagOk : kind === "new" ? imp.tagNew : imp.tagSkip}`}>
                          {kind === "ok" ? "Matched" : kind === "new" ? "New" : "Skipped"}
                        </span>
                      </div>
                    </div>
                    {kind === "new" && (
                      <div className={imp.matchNew}>
                        <label className={imp.label}>New scholarship name
                          <input className={styles.vfInput} value={l.newName} onChange={(e) => upd({ newName: e.target.value })} />
                        </label>
                        <label className={imp.label}>Amount per grantee (₱)
                          <input className={styles.vfInput} type="number" min="0" value={l.newAmount} onChange={(e) => upd({ newAmount: e.target.value })} />
                        </label>
                        <p className={imp.matchNote}>Created when you import, as Suspended, so students can't apply until you finish setting it up under Scholarships.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {!wordDraft.hasSchoolId && (
              <p className={imp.note} style={{ marginTop: 0 }}>
                This list has no School ID column. Anyone who already has a record is matched by name on the next screen; you can type
                the rest in, or download the rows as CSV, fill them in with Excel and upload that.
              </p>
            )}
          </div>
        )}

        {importStep === "preview" && (
          <div>
            <div className={imp.tiles}>
              {[
                { id: "all",  num: importRows.length,   label: "Rows found",           cls: "" },
                { id: "ok",   num: cleanRows.length,    label: "Ready, no issues",     cls: imp.tileOk },
                { id: "warn", num: warnRows.length,     label: "Ready, with warnings", cls: imp.tileWarn },
                { id: "bad",  num: badRows.length,      label: "Will be skipped",      cls: imp.tileBad },
              ].map(t => (
                <button key={t.id} type="button" className={`${imp.tile} ${t.cls} ${previewFilter === t.id ? imp.tileOn : ""}`}
                  onClick={() => setPreviewFilter(t.id)} aria-pressed={previewFilter === t.id}>
                  <span className={imp.tileNum}>{t.num}</span>
                  <span className={imp.tileLabel}>{t.label}</span>
                </button>
              ))}
            </div>

            {importRows[0]?.fromWord && (
              <div className={imp.bulk}>
                <p className={imp.bulkTitle}>Set for all rows at once</p>
                <label className={imp.label}>Semester
                  <select className={styles.vfInput} value={bulkSemester} onChange={(e) => setBulkSemester(e.target.value)}>
                    <option value="">Choose…</option>
                    {VALID_SEMESTERS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className={imp.label}>Date awarded
                  <input className={styles.vfInput} type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
                </label>
                <button type="button" className={styles.pageBtn} onClick={() => applyToAllWord({ semester: bulkSemester, date_awarded: bulkDate })}>Apply to all</button>
                <button type="button" className={styles.pageBtn} onClick={downloadPreviewCsv}>Download as CSV</button>
                <p className={imp.bulkNote}>
                  {noIdCount > 0 ? `${noIdCount} row${noIdCount !== 1 ? "s" : ""} still need a School ID. Type it in the table, or fill the CSV in Excel and upload that. ` : "Every row has a School ID. "}
                  You can also change semester and date row by row.
                </p>
              </div>
            )}

            <div className={imp.tableWrap}>
              {shownRows.length === 0 ? (
                <div className={imp.empty}>No rows in this group.</div>
              ) : (
                <table className={imp.tbl}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>School ID</th>
                      <th>Year / semester</th>
                      {importRows[0]?.fromWord && <th>Date awarded</th>}
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map(r => {
                      const bad = r.errors.length > 0, warn = !bad && r.warnings.length > 0;
                      return (
                        <tr key={r.rowNumber} className={bad ? imp.rowBad : warn ? imp.rowWarn : imp.rowOk}>
                          <td>{r.rowNumber}</td>
                          <td>
                            <span className={imp.who}>{r.first_name} {r.last_name}</span>
                            <span className={imp.sub}>{[r.scholarship_name, r.course, r.year_level && `Year ${r.year_level}`].filter(Boolean).join(" · ")}</span>
                          </td>
                          <td>
                            {r.fromWord ? (
                              <input
                                key={`${r.rowNumber}-${r.school_id}`}
                                className={`${styles.vfInput} ${imp.cellInput}`}
                                defaultValue={r.school_id}
                                placeholder="School ID"
                                aria-label={`School ID for ${r.first_name} ${r.last_name}`}
                                onBlur={(e) => setWordField(r.rawIndex, "school_id", e.target.value)}
                              />
                            ) : (r.school_id || "—")}
                          </td>
                          <td>
                            {r.fromWord && <span className={imp.sub} style={{ marginBottom: 3 }}>{r.academic_year}</span>}
                            {r.fromWord ? (
                              <select
                                key={`${r.rowNumber}-sem-${r.semester}`}
                                className={`${styles.vfInput} ${imp.cellInput}`}
                                style={{ minWidth: 130 }}
                                defaultValue={r.semester}
                                aria-label={`Semester for ${r.first_name} ${r.last_name}`}
                                onChange={(e) => setWordField(r.rawIndex, "semester", e.target.value)}
                              >
                                <option value="">Choose…</option>
                                {VALID_SEMESTERS.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : `${r.academic_year} ${r.semester}`}
                          </td>
                          {r.fromWord && (
                            <td>
                              <input
                                key={`${r.rowNumber}-date-${r.date_awarded}`}
                                className={`${styles.vfInput} ${imp.cellInput}`}
                                style={{ minWidth: 120 }}
                                type="date"
                                defaultValue={r.date_awarded}
                                aria-label={`Date awarded for ${r.first_name} ${r.last_name}`}
                                onBlur={(e) => setWordField(r.rawIndex, "date_awarded", e.target.value)}
                              />
                            </td>
                          )}
                          <td>
                            {bad ? <span className={`${imp.pill} ${imp.pillBad}`}><Icon name="close" size={11} /> Skipped</span>
                              : warn ? <span className={`${imp.pill} ${imp.pillWarn}`}><Icon name="alert" size={11} /> Check</span>
                              : <span className={`${imp.pill} ${imp.pillOk}`}><Icon name="check" size={11} /> Ready</span>}
                            {!bad && <span className={`${imp.pill} ${r.status === "Active" ? imp.pillOk : imp.pillIdle}`} style={{ marginLeft: 6 }} title="Status it will be saved with">{r.status}</span>}
                            {(bad || warn) && (
                              <ul className={imp.msgs}>
                                {(bad ? r.errors : r.warnings).map((m, k) => (
                                  <li key={k} className={`${imp.msg} ${bad ? imp.msgBad : imp.msgWarn}`}>{m}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {importStep === "results" && (
          <div className={imp.done}>
            <div className={`${imp.doneIcon} ${importResults.failed.length > 0 ? imp.doneIconBad : ""}`} aria-hidden="true">
              <Icon name={importResults.failed.length > 0 ? "alert" : "check"} size={26} />
            </div>
            <h3 className={imp.doneTitle}>
              {importResults.succeeded} grantee{importResults.succeeded !== 1 ? "s" : ""} imported
            </h3>
            <p className={imp.doneSub}>
              {importResults.failed.length > 0
                ? `${importResults.failed.length} could not be saved. Details below.`
                : "They now appear in the grantees table. Students can link their account to a record by entering their School ID on their profile."}
            </p>
            {importResults.failed.length > 0 && (
              <div className={imp.failed}>
                <div className={imp.failedHead}>{importResults.failed.length} failed</div>
                {importResults.failed.map(f => (
                  <div key={f.row} className={imp.failedRow}>
                    {f.name} <span>Row {f.row}: {f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* REVOKE A SCHOLARSHIP */}
      <Modal
        open={!!revokeTarget}
        onClose={closeRevoke}
        title="Revoke scholarship"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeRevoke} disabled={savingRevoke}>Cancel</Button>
            <Button variant="danger" onClick={submitRevoke} loading={savingRevoke}>Revoke scholarship</Button>
          </>
        }
      >
        {revokeTarget && (
          <div className={styles.verifySection}>
            <p className={styles.description}>
              <strong>{revokeTarget.student_name}</strong> will lose <strong>{revokeTarget.scholarship_name}</strong>.
              Payouts stop right away and the student is notified.
            </p>
            <Field label="Reason" required hint="Saved on the record and shown to the cashier.">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. GWA fell below the required 2.0"
                />
              )}
            </Field>
            <Field label="Message to the student" hint="This is what appears in their notifications. Edit it if you like.">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={6}
                  value={revokeText}
                  onChange={(e) => setRevokeMessageText(e.target.value)}
                />
              )}
            </Field>
          </div>
        )}
      </Modal>

      {/* REVIEW A STUDENT'S CANCELLATION REQUEST */}
      <Modal
        open={!!reviewTarget}
        onClose={closeReview}
        title="Cancellation request"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeReview} disabled={savingReview}>Close</Button>
            <Button variant="secondary" onClick={() => submitReview("Declined")} disabled={savingReview}>Decline request</Button>
            <Button variant="danger" onClick={() => submitReview("Approved")} loading={savingReview}>Approve and end scholarship</Button>
          </>
        }
      >
        {reviewTarget && (
          <div className={styles.verifySection}>
            <p className={styles.description}>
              <strong>{reviewTarget.row?.student_name || "The student"}</strong> asked to cancel{" "}
              <strong>{reviewTarget.row?.scholarship_name || "their scholarship"}</strong>.
            </p>
            <h4 className={styles.verifySectionTitle}>Their reason</h4>
            <p className={styles.requestReasonFull}>{reviewTarget.request.reason}</p>
            <Field label="Note to the student" hint="Optional when approving, required when declining. It is sent with the notification.">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                />
              )}
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}