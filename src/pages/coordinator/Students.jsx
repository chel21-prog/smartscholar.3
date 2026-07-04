import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "./Students.module.css";
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
    <div className={s.page}>
      <div className={s.header}>
  <div>
    <h1 className={s.title}>Students</h1>
    <p className={s.subtitle}>
      Manage student records, enrollment status, and scholarship assignments.
    </p>
  </div>
  
</div>
<div className={s.toolbar}>
  <input
    type="text"
    placeholder="Search students..."
    value={search}
    onChange={(e) => {
      setSearch(e.target.value);
      setCurrentPage(1);
    }}
    className={s.input}
style={{ maxWidth:320 }}
  />

  <select
    value={statusFilter}
    onChange={(e) => {
      setStatusFilter(e.target.value);
      setCurrentPage(1);
    }}
    className={s.input}
style={{ maxWidth:180 }}
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
    className={s.input}
style={{ maxWidth:220 }}
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
  <div className={s.overlay}>
    <div className={s.modal}>
      <h2>Grant Scholarship</h2>

      <p>
        Student:{" "}
        <b>
          {selectedStudent?.users?.first_name}{" "}
          {selectedStudent?.users?.last_name}
        </b>
      </p>

      <select
        className={s.input}
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

      <button className={s.statusBtn} onClick={grantScholarship}>
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
        <div className={s.card}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>School ID</th>
                <th className={s.th}>Name</th>
                <th className={s.th}>Email</th>
                <th className={s.th}>Course</th>
                <th className={s.th}>Year</th>
                <th className={s.th}>Gender</th>
                <th className={s.th}>Ethnicity</th>
                <th className={s.th}>Contact</th>
                <th className={s.th}>Enrollement Status</th>
                <th className={s.th}>Remarks</th>
                <th className={s.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {paginatedStudents.map((student, index) => (
                <tr
  key={student.student_id}
  className={index % 2 === 0 ? s.rowEven : s.rowOdd}
>
                  <td className={s.td}>{student.school_id}</td>
                  <td className={s.td}>{student.users?.first_name} {student.users?.last_name}</td>
                  <td className={s.td}>{student.users?.email}</td>
                  <td className={s.td}>{student.course}</td>
                  <td className={s.td}>{student.year_level}</td>
                  <td className={s.td}>{student.gender}</td>
                  <td className={s.td}>{student.ethnicity}</td>
                  <td className={s.td}>{student.contact_number}</td>

                  {/* CLICKABLE STATUS */}
                  <td className={s.td}>
  <button
  onClick={() => updateStatus(student.student_id, student.status)}
  className={`${s.badge} ${
    student.status === "Enrolled"
      ? s.statusEnrolled
      : student.status === "Graduated"
      ? s.statusGraduated
      : student.status === "Dropped"
      ? s.statusDropped
      : s.statusInactive
  }`}
>
  {student.status}
</button>
</td>

                  {/* AUTO-SAVE REMARKS */}
                  <td className={s.td}>
                    <textarea
  value={student.remarks || ""}
  onChange={(e) =>
    updateRemarks(student.student_id, e.target.value)
  }
  placeholder="None"
   className={s.remarkInput}
/>
                  </td>
                  <td className={s.td}>
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
  setSelectedStudent(student);
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
      className={s.statusBtn}
      style={{
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
    className={s.statusBtn}
      style={{
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
