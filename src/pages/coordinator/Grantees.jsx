import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./Grantees.module.css";

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
  useEffect(() => {
    load();
  }, []);
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

      students (
        school_id,
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
      scholarship_name: g.scholarships?.scholarship_name ?? "N/A",
      status: g.status,
      academic_year: g.academic_year ?? "N/A",
      semester: g.semester ?? "N/A",
      date_awarded: g.date_awarded,

      documents: granteeDocs,
    };
  });

  setRows(formatted);
  setLoading(false);
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
const startRow = (currentPage - 1) * rowsPerPage + 1;

const endRow = Math.min(
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
          <thead>
            <tr>
              <th className={styles.th}>School ID</th>
              <th className={styles.th}>Student Name</th>
              <th className={styles.th}>Scholarship</th>
              <th className={styles.th}>AY Approved</th>
              <th className={styles.th}>Semester Approved</th>
              <th className={styles.th}>Date Approved</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Documents</th>
            </tr>
          </thead>

          <tbody>
  {paginated.map((row) => {
    const student = row.student;
    const s = row.scholarship;

    return (
      <tr key={s.grantee_id}>

        <td className={styles.td}>
    {student.school_id}
</td>

<td className={styles.td}>
    {student.student_name}
</td>
        <td className={styles.td}>
          {s.scholarship_name}
        </td>

        <td className={styles.td}>
          {s.academic_year}
        </td>

        <td className={styles.td}>
          {s.semester}
        </td>

        <td className={styles.td}>
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
        <div className={styles.pagination}>

    <button
        onClick={() =>
            setCurrentPage(p => Math.max(1,p-1))
        }
        disabled={currentPage===1}
    >
        Previous
    </button>

    <span>
    Showing {startRow}-{endRow} of {tableRows.length} scholarship records
</span>

<span>
    Page {currentPage} of {totalPages}
</span>

    <button
        onClick={() =>
            setCurrentPage(p=>Math.min(totalPages,p+1))
        }
        disabled={currentPage===totalPages}
    >
        Next
    </button>

    

</div>
      </div>
    </div>
  );
}