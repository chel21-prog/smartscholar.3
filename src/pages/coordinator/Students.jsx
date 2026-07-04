import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const STATUS_OPTIONS = ["Enrolled", "Graduated", "Dropped", "Inactive"];

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openGrant, setOpenGrant] = useState(false);
const [selectedStudent, setSelectedStudent] = useState(null);

const [scholarships, setScholarships] = useState([]);
const [selectedScholarship, setSelectedScholarship] = useState("");

const [academicSettings, setAcademicSettings] = useState(null);
const ITEMS_PER_PAGE = 10;

const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("All");
const [courseFilter, setCourseFilter] = useState("All");
const [currentPage, setCurrentPage] = useState(1);

const [remarks, setRemarks] = useState("");
// these are REQUIRED for insert
const academicYear = academicSettings?.academic_year || "";
const semester = academicSettings?.semester || "";

  useEffect(() => {
  loadStudents();
  loadAcademicSettings();
}, []);

  const loadStudents = async () => {
  setLoading(true);

  // Load students
  const { data, error } = await supabase
    .from("students")
    .select(`
      student_id,
      school_id,
      course,
      year_level,
      gender,
      ethnicity,
      contact_number,
      status,
      remarks,
      users (
        first_name,
        last_name,
        email
      )
    `)
    .order("school_id", { ascending: true });

  if (!error) setStudents(data || []);

  // Load active scholarships
  const { data: schols, error: scholError } = await supabase
    .from("scholarships")
    .select("*")
    .eq("status", "Active");

  if (!scholError) setScholarships(schols || []);

  setLoading(false);
};
 
const loadAcademicSettings = async () => {
  const { data, error } = await supabase
    .from("academic_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!error) {
    setAcademicSettings(data);
  }
};

  // CLICK TO CHANGE STATUS
  const updateStatus = async (studentId, currentStatus) => {
    const currentIndex = STATUS_OPTIONS.indexOf(currentStatus);
    const nextStatus =
      STATUS_OPTIONS[(currentIndex + 1) % STATUS_OPTIONS.length];

    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId ? { ...s, status: nextStatus } : s
      )
    );

    await supabase
      .from("students")
      .update({ status: nextStatus })
      .eq("student_id", studentId);
  };

  // AUTO SAVE REMARKS
  const updateRemarks = (studentId, value) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId ? { ...s, remarks: value } : s
      )
    );

    clearTimeout(window.__remarkTimeout);

    window.__remarkTimeout = setTimeout(async () => {
      await supabase
        .from("students")
        .update({ remarks: value })
        .eq("student_id", studentId);
    }, 600);
  };
  
  const grantScholarship = async () => {
  if (!selectedStudent) return alert("No student selected");
  if (!selectedScholarship) return alert("Select scholarship");

  // 1. CREATE APPLICATION FIRST (THIS IS THE FIX)
  const { data: application, error: appError } = await supabase
    .from("scholarship_applications")
    .insert({
      student_id: selectedStudent.student_id,
      scholarship_id: selectedScholarship,
      status: "Approved",
      academic_year: academicYear,
      semester: semester,
    })
    .select()
    .single();

  if (appError) {
    alert(appError.message);
    return;
  }

  // 2. CREATE GRANTEE WITH APPLICATION ID
  const { error } = await supabase.from("grantees").insert({
    student_id: selectedStudent.student_id,
    scholarship_id: selectedScholarship,
    application_id: application.application_id, // ✅ IMPORTANT FIX
    academic_year: academicYear,
    semester: semester,
    date_awarded: new Date().toISOString().split("T")[0], // ✅ auto date
    status: "Active",
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Scholarship granted successfully!");

  // RESET FORM
  setOpenGrant(false);
  setSelectedScholarship("");
  setAcademicYear("");
  setSemester("1st");
  setSelectedStudent(null);
};

const courses = [
  "All",
  ...new Set(students.map((s) => s.course).filter(Boolean)),
];

const filteredStudents = students.filter((s) => {
  const keyword = search.toLowerCase();

  const matchesSearch =
    (s.school_id || "").toLowerCase().includes(keyword) ||
    (s.users?.first_name || "").toLowerCase().includes(keyword) ||
    (s.users?.last_name || "").toLowerCase().includes(keyword) ||
    (s.users?.email || "").toLowerCase().includes(keyword) ||
    (s.course || "").toLowerCase().includes(keyword) ||
    (s.year_level || "").toString().includes(keyword) ||
    (s.gender || "").toLowerCase().includes(keyword) ||
    (s.ethnicity || "").toLowerCase().includes(keyword) ||
    (s.contact_number || "").toLowerCase().includes(keyword) ||
    (s.status || "").toLowerCase().includes(keyword);

  const matchesStatus =
    statusFilter === "All" ||
    s.status === statusFilter;

  const matchesCourse =
    courseFilter === "All" ||
    s.course === courseFilter;

  return (
    matchesSearch &&
    matchesStatus &&
    matchesCourse
  );
});

const totalPages = Math.ceil(
  filteredStudents.length / ITEMS_PER_PAGE
);

const paginatedStudents = filteredStudents.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);
  return (
    <div style={styles.page}>
      <div style={styles.header}>
  <div>
    <h1 style={styles.title}>Students</h1>
    <p style={styles.subtitle}>
      Manage student records, enrollment status, and scholarship assignments.
    </p>
  </div>
  
</div>
<div
  style={{
    display: "flex",
    gap: 15,
    marginBottom: 20,
    flexWrap: "wrap",
    alignItems: "center",
  }}
>
  <input
    type="text"
    placeholder="Search students..."
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setCurrentPage(1);
    }}
    style={{
      ...styles.input,
      maxWidth: 320,
      color: "#475c6c",
    }}
  />

  <select
    value={statusFilter}
    onChange={(e) => {
      setStatusFilter(e.target.value);
      setCurrentPage(1);
    }}
    style={{
      ...styles.input,
      maxWidth: 180,
      color: "#475c6c",
    }}
  >
    <option value="All">All Status</option>
    <option value="Enrolled">Enrolled</option>
    <option value="Graduated">Graduated</option>
    <option value="Dropped">Dropped</option>
    <option value="Inactive">Inactive</option>
  </select>

  <select
    value={courseFilter}
    onChange={(e) => {
      setCourseFilter(e.target.value);
      setCurrentPage(1);
    }}
    style={{
      ...styles.input,
      maxWidth: 220,
      color: "#475c6c",
    }}
  >
    {courses.map((course) => (
      <option
        key={course}
        value={course}
      >
        {course === "All"
          ? "All Courses"
          : course}
      </option>
    ))}
  </select>
</div>
      {openGrant && (
  <div style={styles.overlay}>
    <div style={styles.modal}>
      <h2>Grant Scholarship</h2>

      <p>
        Student:{" "}
        <b>
          {selectedStudent?.users?.first_name}{" "}
          {selectedStudent?.users?.last_name}
        </b>
      </p>

      <select
        style={styles.input}
        value={selectedScholarship}
        onChange={(e) => setSelectedScholarship(e.target.value)}
      >
        <option value="">Select Scholarship</option>
        {scholarships.map((s) => (
          <option key={s.scholarship_id} value={s.scholarship_id}>
            {s.scholarship_name}
          </option>
        ))}
      </select>

      <p>
  <b>Academic Year:</b> {academicSettings?.academic_year}
</p>

<p>
  <b>Semester:</b> {academicSettings?.semester}
</p>

      <button style={styles.statusBtn} onClick={grantScholarship}>
        Grant
      </button>

      <button onClick={() => setOpenGrant(false)}>
        Cancel
      </button>
    </div>
  </div>
)}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead style={styles.thead}>
              <tr>
                <th style={styles.th}>School ID</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Course</th>
                <th style={styles.th}>Year</th>
                <th style={styles.th}>Gender</th>
                <th style={styles.th}>Ethnicity</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Enrollement Status</th>
                <th style={styles.th}>Remarks</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {paginatedStudents.map((s, index) => (
                <tr
  key={s.student_id}
  style={
    index % 2 === 0
      ? styles.rowEven
      : styles.rowOdd
  }
>
                  <td style={styles.td}>{s.school_id}</td>
                  <td style={styles.td}>{s.users?.first_name} {s.users?.last_name}</td>
                  <td style={styles.td}>{s.users?.email}</td>
                  <td style={styles.td}>{s.course}</td>
                  <td style={styles.td}>{s.year_level}</td>
                  <td style={styles.td}>{s.gender}</td>
                  <td style={styles.td}>{s.ethnicity}</td>
                  <td style={styles.td}>{s.contact_number}</td>

                  {/* CLICKABLE STATUS */}
                  <td style={styles.td}>
                    <button
                      onClick={() => updateStatus(s.student_id, s.status)}
                      style={{
  ...styles.badge,
  background:
    s.status === "Enrolled"
      ? "#dcfce7"
      : s.status === "Graduated"
      ? "#dbeafe"
      : s.status === "Dropped"
      ? "#fee2e2"
      : "#f3f4f6",

  color:
    s.status === "Enrolled"
      ? "#166534"
      : s.status === "Graduated"
      ? "#1d4ed8"
      : s.status === "Dropped"
      ? "#991b1b"
      : "#475c6c",

  border: "none",
  cursor: "pointer",
}}
                    >
                      {s.status}
                    </button>
                  </td>

                  {/* AUTO-SAVE REMARKS */}
                  <td style={styles.td}>
                    <textarea
  value={s.remarks || ""}
  onChange={(e) =>
    updateRemarks(s.student_id, e.target.value)
  }
  placeholder="None"
  style={styles.remarkInput}
/>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{
                      padding: "6px 10px",
                      border: "none",
                      borderRadius: 6,
                      background: "#475c6c",
                      fontWeight: 600,
transition: ".2s",
                      color: "white",
                      cursor: "pointer",
                      }}
                      onClick={() => {
  setSelectedStudent(s);
  setOpenGrant(true);
}}
                      >
                      Grant Scholarship
                      </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
          
        </div>
        
      )}
      <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    flexWrap: "wrap",
    gap: 10,
  }}
>
  <span>
    Showing{" "}
    {filteredStudents.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1}
    {" - "}
    {Math.min(
      currentPage * ITEMS_PER_PAGE,
      filteredStudents.length
    )}{" "}
    of {filteredStudents.length}
  </span>

  <div
    style={{
      display: "flex",
      gap: 8,
      alignItems: "center",
    }}
  >
    <button
      style={{
  ...styles.statusBtn,
  opacity: currentPage === 1 ? .5 : 1,
  cursor: currentPage === 1 ? "not-allowed" : "pointer",
}}
      disabled={currentPage === 1}
      onClick={() =>
        setCurrentPage((p) => p - 1)
      }
    >
      Previous
    </button>

    <span>
      Page {totalPages === 0 ? 0 : currentPage} of{" "}
      {totalPages || 1}
    </span>

    <button
      style={{
  ...styles.statusBtn,
  opacity:
    currentPage === totalPages || totalPages === 0
      ? .5
      : 1,
  cursor:
    currentPage === totalPages || totalPages === 0
      ? "not-allowed"
      : "pointer",
}}
      disabled={
        currentPage === totalPages ||
        totalPages === 0
      }
      onClick={() =>
        setCurrentPage((p) => p + 1)
      }
    >
      Next
    </button>
  </div>
</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "#f5f6f8",
    fontFamily: "Inter, sans-serif",
    color: "#475c6c",
  },

  header: {
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: "#475c6c",
  },

  subtitle: {
    marginTop: 6,
    color: "#8a8583",
    fontSize: 14,
  },

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,.06)",
    overflowX: "auto",
  },

  table: {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1050, // or even 1000
},

  thead: {
    background: "#475c6c",
  },

  th: {
  padding: "10px 12px",
  color: "#fff",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
},

  td: {
  padding: "8px 12px",
  borderBottom: "1px solid #ececec",
  color: "#475c6c",
  fontSize: 13,
  verticalAlign: "middle",
},

  badge: {
  padding: "5px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
},

  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d9d9d9",
    borderRadius: 8,
    background: "#fff",
    color: "#475c6c",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(71,92,108,.35)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },

  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 20px 40px rgba(0,0,0,.15)",
  },

  statusBtn: {
  padding: "9px 16px",
  background: "#475c6c",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  transition: ".2s",
},
rowEven: {
  background: "#fff",
},

rowOdd: {
  background: "#f9fafb",
},
remarkInput: {
  width: 180,
  minWidth: 160,
  maxWidth: 180,

  minHeight: 72,
  maxHeight: 72,

  padding: "8px 10px",

  fontSize: 12,

  resize: "none",
  background: "#fff",
  color: "#475c6c",
  overflowY: "auto",
  overflowX: "hidden",

  scrollbarWidth: "none",
  msOverflowStyle: "none",

  border: "1px solid #d9d9d9",
  borderRadius: 8,

  boxSizing: "border-box",
},
};