import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Grantees() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,setSearch]=useState("");
  const [statusFilter, setStatusFilter] = useState("All");
const [scholarshipFilter, setScholarshipFilter] = useState("All");
const [semesterFilter, setSemesterFilter] = useState("All");
const [yearFilter, setYearFilter] = useState("All");
  useEffect(() => {
    load();
  }, []);

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
  return (
    <div style={styles.page}>
      <div style={styles.header}>
    <div>
        <h1 style={styles.title}>
            Scholarship Grantees
        </h1>

        <p style={styles.subtitle}>
            View all approved scholarship recipients and their submitted requirements.
        </p>
    </div>
</div>
    
    <div style={styles.statsRow}>
  <div style={styles.statCard}>
    <div style={styles.statNumber}>{rows.length}</div>
    <div style={styles.statLabel}>Scholarship Awards</div>
  </div>

  <div style={styles.statCard}>
    <div style={styles.statNumber}>
      {Object.keys(grouped).length}
    </div>
    <div style={styles.statLabel}>Total Grantees</div>
  </div>

  <div style={styles.statCard}>
    <div style={styles.statNumber}>
      {rows.filter((r) => r.status === "Active").length}
    </div>
    <div style={styles.statLabel}>Active Grantees</div>
  </div>
</div>

<div style={styles.toolbar}>

    <input
        type="text"
        placeholder="Search grantees..."
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
        style={styles.search}
    />

    <select
        value={statusFilter}
        onChange={(e)=>setStatusFilter(e.target.value)}
        style={styles.select}
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
        style={styles.select}
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
        style={styles.select}
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
        style={styles.select}
    >
        {semesterOptions.map(option=>(
            <option key={option}>
                {option}
            </option>
        ))}
    </select>

</div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>School ID</th>
              <th style={styles.th}>Student Name</th>
              <th style={styles.th}>Scholarship</th>
              <th style={styles.th}>AY Approved</th>
              <th style={styles.th}>Semester Approved</th>
              <th style={styles.th}>Date Approved</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Documents</th>
            </tr>
          </thead>

          <tbody>
 {filtered.map((student) => (
  <React.Fragment key={student.school_id}>
      {student.scholarships.map((s, index) => (
        <tr key={s.grantee_id}>

          {/* ✅ MERGED STUDENT CELL */}
          {index === 0 && (
            <td
  rowSpan={student.scholarships.length}
  style={{
    ...styles.td,
    verticalAlign: "middle",
    fontWeight: 600,
  }}
>
              {student.school_id}
            </td>
          )}
          {index === 0 && (
            <td style={styles.td}
              rowSpan={student.scholarships.length}
              style={{ verticalAlign: "middle", fontWeight: "bold" }}
            >
              {student.student_name}
            </td>
          )}
          <td style={styles.td}>{s.scholarship_name}</td>
          <td style={styles.td}>{s.academic_year}</td>
          <td style={styles.td}>{s.semester}</td>

          <td style={styles.td}>
            {s.date_awarded
              ? new Date(s.date_awarded).toLocaleDateString()
              : "Not set"}
          </td>

          <td style={styles.td}>
            <span
  style={{
    ...styles.badge,
    background:
      s.status === "Active"
        ? "#dcfce7"
        : "#fef3c7",
    color:
      s.status === "Active"
        ? "#166534"
        : "#92400e",
  }}
>
  {s.status}
</span>
          </td>

          <td style={styles.td}>
            {!s.documents || s.documents.length === 0 ? (
              <span style={{ color: "#999" }}>No files uploaded</span>
            ) : (
              s.documents.map((d, i) => (
                <div key={i}>
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.documentButton}
                  >
                    {d.requirement_name || "View Document"}
                  </a>
                </div>
              ))
            )}
          </td>

        </tr>
      ))}
    </React.Fragment  >
  ))}
</tbody>
        </table>
      </div>
    </div>
  );
}

/* STYLES */
const styles = {
  page:{
    minHeight:"100vh",
    padding:"40px",
    background:"#f4f6f8",
    fontFamily:"Inter, sans-serif",
},

  title:{
    margin:0,
    fontSize:30,
    color:"#475c6c",
    fontWeight:700,
},

  tableContainer:{
    background:"#fff",
    borderRadius:16,
    overflow:"hidden",
    boxShadow:"0 10px 24px rgba(0,0,0,.06)",
    border:"1px solid #e5e7eb",
},

  table: {
    width: "100%",
    minWidth: 900,
    borderCollapse: "collapse",
  },
documentButton:{
    display:"inline-block",
    padding:"8px 12px",
    background:"#475c6c",
    color:"#fff",
    borderRadius:8,
    textDecoration:"none",
    fontSize:12,
    marginBottom:6,
},
  th:{
    background:"#475c6c",
    color:"#fff",
    padding:"14px",
    textAlign:"left",
    fontWeight:600,
    fontSize:14,
},

  td: {
    padding: 12,
    borderBottom: "1px solid #eee",
    fontSize: 13,
    verticalAlign: "top",
  },

  badge: {
    background: "#dcfce7",
    color: "#166534",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  },

  link: {
    display: "inline-block",
    color: "#2563eb",
    fontSize: 12,
    textDecoration: "underline",
  },

  header:{
    display:"flex",
    justifyContent:"space-between",
    alignItems:"center",
    marginBottom:30,
},

subtitle:{
    marginTop:6,
    color:"#8a8583",
    fontSize:14,
},

statsRow:{
    display:"grid",
    gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
    gap:20,
    marginBottom:24,
},

statCard:{
    background:"#fff",
    padding:20,
    borderRadius:16,
    boxShadow:"0 10px 24px rgba(0,0,0,.06)",
},

statNumber:{
    fontSize:28,
    fontWeight:700,
    color:"#475c6c",
},

statLabel:{
    marginTop:8,
    color:"#8a8583",
},

toolbar:{
    display:"flex",
    flexWrap:"wrap",
    gap:12,
    alignItems:"center",
    marginBottom:24,
},

search:{
    width:350,
    padding:"12px 15px",
    borderRadius:10,
    border:"1px solid #d1d5db",
    outline:"none",
    fontSize:14,
},
select:{
    padding:"12px 14px",
    border:"1px solid #d1d5db",
    borderRadius:10,
    background:"#fff",
    color:"#475c6c",
    fontSize:14,
    outline:"none",
    minWidth:170,
},
};