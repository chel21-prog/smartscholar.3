import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";
import s from "./Students.module.css";
const STATUS_OPTIONS = ["Enrolled", "Graduated", "Dropped", "Inactive"];

export default function Students() {
  const toast = useToast();
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
  else toast.error("Failed to load students: " + error.message);

  // Load active scholarships
  const { data: schols, error: scholError } = await supabase
    .from("scholarships")
    .select("*")
    .eq("status", "Active");

  if (!scholError) setScholarships(schols || []);
  else toast.error("Failed to load scholarships: " + scholError.message);

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

    const { error } = await supabase
      .from("students")
      .update({ status: nextStatus })
      .eq("student_id", studentId);

    if (error) {
      // Roll back the optimistic update — the DB write failed, so the UI
      // shouldn't keep showing the new status as if it saved.
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === studentId ? { ...s, status: currentStatus } : s
        )
      );
      toast.error("Failed to update status: " + error.message);
    }
  };

  // AUTO SAVE REMARKS
  // Bug fix: previously used a single global `window.__remarkTimeout`,
  // shared across every row. Editing student B before A's 600ms timer
  // fired would clearTimeout A's pending save and silently drop it.
  // Each student now gets its own timer, keyed by student_id.
  const remarkTimeouts = useRef(new Map());

  const updateRemarks = (studentId, value) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId ? { ...s, remarks: value } : s
      )
    );

    const timeouts = remarkTimeouts.current;
    clearTimeout(timeouts.get(studentId));

    const timeoutId = setTimeout(async () => {
      const { error } = await supabase
        .from("students")
        .update({ remarks: value })
        .eq("student_id", studentId);

      if (error) console.error("Failed to save remarks:", error.message);
      timeouts.delete(studentId);
    }, 600);

    timeouts.set(studentId, timeoutId);
  };
  
  const grantScholarship = async () => {
  if (!selectedStudent) return toast.error("No student selected");
  if (!selectedScholarship) return toast.error("Select scholarship");

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
    toast.error(appError.message);
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
    toast.error(error.message);
    return;
  }

  toast.success("Scholarship granted successfully!");

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
  <div className={s.overlay} onClick={() => setOpenGrant(false)}>
    <div
      className={s.modal}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={s.modalHeader}>
        <div>
          <h2 className={s.modalTitle}>Grant Scholarship</h2>
          <p className={s.modalSubtitle}>
            Assign a scholarship to this student
          </p>
        </div>

        <button
          className={s.modalClose}
          onClick={() => setOpenGrant(false)}
        >
          ✕
        </button>
      </div>

      <div className={s.modalBody}>

        <div className={s.studentCard}>
         

          <div>
            <span className={s.studentLabel}>Student</span>
            <strong className={s.studentName}>
              {selectedStudent?.users?.first_name}{" "}
              {selectedStudent?.users?.last_name}
            </strong>
          </div>
        </div>

        <div className={s.formGroup}>
          <label className={s.formLabel}>
            Scholarship Program
          </label>

          <select
            className={s.input}
            value={selectedScholarship}
            onChange={(e) => setSelectedScholarship(e.target.value)}
          >
            <option value="">Select Scholarship</option>

            {scholarships.map((scholarship) => (
              <option
                key={scholarship.scholarship_id}
                value={scholarship.scholarship_id}
              >
                {scholarship.scholarship_name}
              </option>
            ))}
          </select>
        </div>

        <div className={s.academicCard}>
          <div>
            <span>Academic Year</span>
            <strong>
              {academicSettings?.academic_year || "Not set"}
            </strong>
          </div>

          <div>
            <span>Semester</span>
            <strong>
              {academicSettings?.semester || "Not set"}
            </strong>
          </div>
        </div>

        <div className={s.warningBox}>
          <span>ⓘ</span>
          <p>
            Granting this scholarship will create an approved application
            and activate the student's scholarship grant.
          </p>
        </div>

      </div>

      <div className={s.modalFooter}>
        <button
          className={s.cancelModalBtn}
          onClick={() => setOpenGrant(false)}
        >
          Cancel
        </button>

        <button
          className={s.grantBtn}
          onClick={grantScholarship}
        >
          Grant Scholarship
        </button>
      </div>
    </div>
  </div>
)}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>School ID</th>
                <th className={s.th}>Name</th>
                <th className={`${s.th} ${s.colOptional}`}>Email</th>
                <th className={s.th}>Course</th>
                <th className={s.th}>Year</th>
                <th className={`${s.th} ${s.colOptional}`}>Gender</th>
                <th className={`${s.th} ${s.colOptional}`}>Ethnicity</th>
                <th className={`${s.th} ${s.colOptional}`}>Contact</th>
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
                  <td className={`${s.td} ${s.colOptional}`}>{student.users?.email}</td>
                  <td className={s.td}>{student.course}</td>
                  <td className={s.td}>{student.year_level}</td>
                  <td className={`${s.td} ${s.colOptional}`}>{student.gender}</td>
                  <td className={`${s.td} ${s.colOptional}`}>{student.ethnicity}</td>
                  <td className={`${s.td} ${s.colOptional}`}>{student.contact_number}</td>

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
      <div className={s.pagination}>
  <span className={s.pageInfo}>
    {filteredStudents.length === 0
      ? "0"
      : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(
          currentPage * ITEMS_PER_PAGE,
          filteredStudents.length
        )}`}{" "}
    of {filteredStudents.length}
  </span>

  <div className={s.pageButtons}>
    <button
      className={s.pageBtn}
      disabled={currentPage === 1}
      onClick={() => setCurrentPage((p) => p - 1)}
    >
      Previous
    </button>

    <span className={s.pageInfo}>
      Page {totalPages === 0 ? 0 : currentPage} of{" "}
      {totalPages || 1}
    </span>

    <button
      className={s.pageBtn}
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
    </div>
  );
}
