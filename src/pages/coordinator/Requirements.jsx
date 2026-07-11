import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/ui/Modal";
import styles from "./Grantees.module.css";

const VERIFICATION_LABELS = {
  Verified: "Verified",
  "Pending Review": "Pending Review",
  Ineligible: "Ineligible",
};

export default function Grantees() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // ── duration extension modal ──────────────────────────────
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendSemesters, setExtendSemesters] = useState(0);
  const [extendReason, setExtendReason] = useState("");
  const [savingExtension, setSavingExtension] = useState(false);

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
  setLoading(true);

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
      duration_extension_semesters,
      extension_reason,

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
      duration_extension_semesters: g.duration_extension_semesters ?? 0,
      extension_reason: g.extension_reason,

      documents: granteeDocs,
    };
  });

  setRows(formatted);
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
      alert("Enter a reason before marking this grantee ineligible.");
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
      alert(updateError.message);
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
      alert(historyError.message);
    }

    setSavingVerification(false);
    closeVerify();
    load();
  };

  const openExtend = (row) => {
    setExtendTarget(row);
    setExtendSemesters(row.duration_extension_semesters || 0);
    setExtendReason(row.extension_reason || "");
  };

  const closeExtend = () => setExtendTarget(null);

  const submitExtension = async () => {
    if (!extendTarget) return;
    if (Number(extendSemesters) > 0 && !extendReason.trim()) {
      alert("Enter a reason for the extension (e.g. took a 5th year to graduate).");
      return;
    }

    setSavingExtension(true);
    const { error } = await supabase
      .from("grantees")
      .update({
        duration_extension_semesters: Number(extendSemesters) || 0,
        extension_reason: extendReason || null,
      })
      .eq("grantee_id", extendTarget.grantee_id);

    setSavingExtension(false);

    if (error) {
      alert(error.message);
      return;
    }

    closeExtend();
    load();
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
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
        student.school_id.toLowerCase().includes(keyword) ||
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
</div>
    
    <div className={styles.statsRow}>
  <div className={styles.statCard}>
    <div className={styles.statNumber}>{rows.length}</div>
    <div className={styles.statLabel}>Scholarship Awards</div>
  </div>

  <div className={styles.statCard}>
    <div className={styles.statNumber}>
      {Object.keys(grouped).length}
    </div>
    <div className={styles.statLabel}>Total Grantees</div>
  </div>

  <div className={styles.statCard}>
    <div className={styles.statNumber}>
      {rows.filter((r) => r.status === "Active").length}
    </div>
    <div className={styles.statLabel}>Active Grantees</div>
  </div>
</div>

<div className={styles.toolbar}>

    <input
        type="text"
        placeholder="Search grantees..."
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
        className={styles.search}
    />

    <select
        value={statusFilter}
        onChange={(e)=>setStatusFilter(e.target.value)}
        className={styles.select}
    >
        {statusOptions.map(option=>(
            <option key={option}>
                {option}
            </option>
        ))}
    </select>

    <select
        value={scholarshipFilter}
        onChange={(e)=>setScholarshipFilter(e.target.value)}
        className={styles.select}
    >
        {scholarshipOptions.map(option=>(
            <option key={option}>
                {option}
            </option>
        ))}
    </select>

    <select
        value={yearFilter}
        onChange={(e)=>setYearFilter(e.target.value)}
        className={styles.select}
    >
        {yearOptions.map(option=>(
            <option key={option}>
                {option}
            </option>
        ))}
    </select>

    <select
        value={semesterFilter}
        onChange={(e)=>setSemesterFilter(e.target.value)}
        className={styles.select}
    >
        {semesterOptions.map(option=>(
            <option key={option}>
                {option}
            </option>
        ))}
    </select>

</div>

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
            </tr>
          </thead>

          <tbody>
  {paginated.map((row) => {
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
          <div>
            <span
              className={`${styles.badge} ${
                s.verification_result === "Verified"
                  ? styles.active
                  : styles.inactive
              }`}
            >
              {VERIFICATION_LABELS[s.verification_result] || s.verification_result}
            </span>
          </div>
          <button
            className={styles.documentButton}
            onClick={() => openVerify(s)}
          >
            {s.verification_result === "Verified" ? "Re-verify" : "Verify"}
          </button>
          <button
            className={styles.pageBtn}
            onClick={() => openExtend(s)}
          >
            {Number(s.duration_extension_semesters) > 0 ? `+${s.duration_extension_semesters} sem` : "Extend"}
          </button>
        </td>

        <td className={styles.td}>
          {!s.documents || s.documents.length === 0 ? (
            <span className={styles.documentPlaceholder}>
              No files uploaded
            </span>
          ) : (
            s.documents.map((d, i) => (
              <div key={i}>
                <a
                  href={d.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.documentButton}
                >
                  {d.requirement_name || "View Document"}
                </a>
              </div>
            ))
          )}
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

      <Modal
        open={!!extendTarget}
        onClose={closeExtend}
        title="Extend Duration"
        footer={
          <>
            <button className={styles.pageBtn} onClick={closeExtend}>Cancel</button>
            <button
              className={styles.documentButton}
              disabled={savingExtension}
              onClick={submitExtension}
            >
              {savingExtension ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {extendTarget && (
          <div className={styles.verifyForm}>
            <p className={styles.description}>
              Grants {extendTarget.student_name} extra periods beyond this scholarship's normal duration
              (e.g. a 5th year to graduate). This only affects this grantee — not the whole scholarship.
            </p>
            <div className={styles.verifySection}>
              <h4 className={styles.verifySectionTitle}>Additional semesters</h4>
              <input
                className={styles.search}
                type="number"
                min="0"
                value={extendSemesters}
                onChange={(e) => setExtendSemesters(e.target.value)}
              />
            </div>
            <textarea
              className={styles.search}
              placeholder="Reason (e.g. approved 5th year, medical leave extension)"
              rows={2}
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}