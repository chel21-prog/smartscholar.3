import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CoordinatorDashboard() {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [academic, setAcademic] = useState(null);
  const [scholarStats, setScholarStats] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
const [showReportModal, setShowReportModal] = useState(false);
const [form, setForm] = useState({
  academic_year: "",
  semester: "",
});
// Pagination

const [reportLayout, setReportLayout] = useState("portrait");

const [columns, setColumns] = useState({
  schoolId: true,
  studentName: true,
  scholarship: true,
  course: true,
  yearLevel: true,
  academicYear: true,
  semester: true,
  status: true,
});

const [signatories, setSignatories] = useState([
  {
    name: "",
    position: "",
  },
]);

const [filterOptions, setFilterOptions] = useState({
  scholarships: [],
  courses: [],
  yearLevels: [],
  statuses: [],
  academicYears: [],
});


  useEffect(() => {
  load();
  loadAcademic();
  loadScholarStats();
  loadUpcomingDeadlines();
}, []);

  const load = async () => {
    setLoading(true);

    const { data } = await supabase
  .from("scholarship_applications")
  .select(`
    application_id,
    status,
    application_date,
    scholarship_id,
    academic_year,
    semester,
    students (
      school_id,
      course,
      year_level,

      users (
        first_name,
        middle_name,
        last_name
      )
    ),

    scholarships (
      scholarship_name
    )
  `)
  .order("application_date", { ascending: false });

    setApplications(data || []);
    const scholarships = [
  ...new Set(
    (data || []).map(
      (a) => a.scholarships?.scholarship_name
    )
  ),
];

const courses = [
  ...new Set(
    (data || []).map(
      (a) => a.students?.course
    )
  ),
];

const yearLevels = [
  ...new Set(
    (data || []).map(
      (a) => a.students?.year_level
    )
  ),
];

const statuses = [
  ...new Set(
    (data || []).map(
      (a) => a.status
    )
  ),
];

const academicYears = [
  ...new Set(
    (data || [])
      .map((a) => a.academic_year)
      .filter(Boolean)
  ),
];

setFilterOptions({
  scholarships,
  courses,
  yearLevels,
  statuses,
  academicYears,
});


    setLoading(false);
  };
  
  const [reportFilters, setReportFilters] = useState({
  reportType: "grantees",
  academicYear: "All",
  semester: "All",
  scholarship: "All",
  course: "All",
  yearLevel: "All",
  status: "All",
});

  const loadScholarStats = async () => {
  // Get all scholarships with slot capacity
  const { data: scholarships, error: scholarshipError } =
    await supabase
      .from("scholarships")
      .select(`
        scholarship_id,
        scholarship_name,
        slots
      `);

  if (scholarshipError) {
    console.error(scholarshipError);
    return;
  }

  // Get every grantee
  const { data: grantees, error: granteeError } =
    await supabase
      .from("grantees")
      .select(`
        scholarship_id,
        status
      `);

  if (granteeError) {
    console.error(granteeError);
    return;
  }

  const stats = scholarships.map((scholarship) => {
    const occupied = grantees.filter(
      (g) =>
        g.scholarship_id === scholarship.scholarship_id &&
        g.status === "Active"
    ).length;

    return {
      scholarship_id: scholarship.scholarship_id,
      scholarship_name: scholarship.scholarship_name,
      occupied,
      slots: scholarship.slots,
    };
  });

  setScholarStats(stats);
};

const loadUpcomingDeadlines = async () => {
  const { data, error } = await supabase
    .from("scholarships")
    .select(`
      scholarship_name,
      submission_deadline
    `)
    .eq("status", "Active")
    .order("submission_deadline", { ascending: true })
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  setUpcomingDeadlines(data || []);
};

const loadImage = (src) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
  });
};

const filteredApplications =
  applications.filter((a) => {

    if (
      reportFilters.scholarship !== "All" &&
      a.scholarships?.scholarship_name !==
        reportFilters.scholarship
    )
      return false;

    if (
      reportFilters.course !== "All" &&
      a.students?.course !==
        reportFilters.course
    )
      return false;

    if (
      reportFilters.yearLevel !== "All" &&
      String(a.students?.year_level) !==
        reportFilters.yearLevel
    )
      return false;

    if (
      reportFilters.status !== "All" &&
      a.status !== reportFilters.status
    )
      return false;

    if (
  reportFilters.academicYear !== "All" &&
  a.academic_year !== reportFilters.academicYear
)
  return false;

if (
  reportFilters.semester &&
  reportFilters.semester !== "All" &&
  a.semester !== reportFilters.semester
)
  return false;

    return true;
  });

  
const generatePDF = async () => {
  const doc = new jsPDF(
    reportLayout === "landscape"
      ? "landscape"
      : "portrait"
  );

  // Load images from public folder
  const headerImg = await loadImage("/header.png");
  const footerImg = await loadImage("/footer.png");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const headers = [];

  if (columns.schoolId) headers.push("School ID");
  if (columns.studentName) headers.push("Student Name");
  if (columns.scholarship) headers.push("Scholarship");
  if (columns.course) headers.push("Course");
  if (columns.yearLevel) headers.push("Year Level");
  if (columns.academicYear) headers.push("Academic Year");
  if (columns.semester) headers.push("Semester");
  if (columns.status) headers.push("Status");


  
  const rows = filteredApplications.map((a) => {
    const row = [];

    if (columns.schoolId)
      row.push(a.students?.school_id);

    if (columns.studentName)
      row.push(
        `${a.students?.users?.first_name || ""} ${
          a.students?.users?.last_name || ""
        }`
      );

    if (columns.scholarship)
      row.push(a.scholarships?.scholarship_name);

    if (columns.course)
      row.push(a.students?.course);

    if (columns.yearLevel)
      row.push(a.students?.year_level);

    if (columns.academicYear)
    row.push(a.academic_year);

    if (columns.semester)
    row.push(a.semester);

    if (columns.status)
      row.push(a.status);

    return row;
  });

  // Header
  doc.addImage(
    headerImg,
    "PNG",
    0,
    0,
    pageWidth,
    25
  );

  doc.setFontSize(14);
  doc.text(
    "Scholarship Report",
    pageWidth / 2,
    35,
    { align: "center" }
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 45,

    margin: {
      top: 40,
      bottom: 30,
    },

    didDrawPage: (data) => {
      // Header every page
      doc.addImage(
        headerImg,
        "PNG",
        0,
        0,
        pageWidth,
        25
      );

      // Footer every page
      doc.addImage(
        footerImg,
        "PNG",
        0,
        pageHeight - 20,
        pageWidth,
        20
      );

      // Page Number
      doc.setFontSize(10);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageWidth - 20,
        pageHeight - 8
      );
    },
  });

  // Signatories
  let y =
    doc.lastAutoTable.finalY + 20;

  signatories.forEach((s, index) => {
    const x =
      20 +
      index *
        ((pageWidth - 40) /
          signatories.length);

    doc.line(x, y, x + 50, y);

    doc.text(
      s.name || "",
      x,
      y + 5
    );

    doc.text(
      s.position || "",
      x,
      y + 12
    );
  });

  doc.save("Scholarship_Report.pdf");
};



const exportReport = async () => {
  const { data, error } = await supabase
.from("grantees")
.select(`
  semester,
  academic_year,

  students (
  student_id,
  school_id,
  course,
  year_level,

  users (
    first_name,
    middle_name,
    last_name
  )
),

  scholarships (
    scholarship_name,
    amount
  )
`)
.order("scholarship_id");

if (error) {
  alert(error.message);
  return;
}

const doc = new jsPDF("landscape");

doc.setFontSize(14);

doc.text(
  `MASTERLIST OF SCHOLARS/GRANTEES, AY ${academic?.academic_year}`,
  14,
  15
);

const rows = data.map((g, index) => [

  g.scholarships?.scholarship_name,

  index + 1,

  g.students?.users?.last_name,

  g.students?.users?.first_name,

  g.students?.users?.middle_name
    ?.charAt(0)
    .toUpperCase() || "",

  g.students?.course,

  g.students?.year_level,

  g.students?.year_level,

  g.scholarships?.amount,

  g.semester

]);

autoTable(doc, {

  head: [[
    "Scholarship Grant",
    "Seq",
    "Last",
    "First",
    "MI",
    "Program",
    "Year",
    "Level",
    "Amount",
    "Granted/Sem"
  ]],

  body: rows,

  startY: 25,

  theme: "grid",

  styles: {
    fontSize: 8
  }

});

doc.save(
  `Masterlist_${academic?.academic_year}.pdf`
);

};

  const loadAcademic = async () => {
  const { data, error } = await supabase
    .from("academic_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!error && data) {
    setAcademic(data);

    setForm({
      academic_year: data.academic_year,
      semester: data.semester,
    });
  }
};

const updateStatus = async (id, status) => {
  const { error } = await supabase
    .from("scholarship_applications")
    .update({ status })
    .eq("application_id", id);

  if (error) {
    alert(error.message);
    return;
  }

  load();
};

  // VIEW ANSWERS
  const viewAnswers = async (app) => {
    
    setSelectedApp(app);

    const { data } = await supabase
      .from("application_form_responses")
      .select(`
        answer,
        scholarship_form_fields (
          label
        )
      `)
      .eq("application_id", app.application_id);

    setAnswers(data || []);
  };

  
  const approveApplication = async (app) => {
  // STEP 1: update status
  const { error } = await supabase
    .from("scholarship_applications")
    .update({ status: "Approved" })
    .eq("application_id", app.application_id);

  if (error) return alert(error.message);

  // STEP 2: insert into grantees table
  const { error: insertError } = await supabase
    .from("grantees")
    .insert({
  student_id: app.students.student_id,
  scholarship_id: app.scholarship_id,
  application_id: app.application_id,
  status: "Active",

  academic_year: app.academic_year,
  semester: app.semester,
})

  if (insertError) {
    return alert(insertError.message);
  }

  // STEP 3: update UI
  setApplications((prev) =>
    prev.map((a) =>
      a.application_id === app.application_id
        ? { ...a, status: "Approved" }
        : a
    )
  );
};

  const saveAcademic = async () => {
  if (!academic) return;

  const { error } = await supabase
    .from("academic_settings")
    .update({
      academic_year: form.academic_year,
      semester: form.semester,
      updated_at: new Date().toISOString(),
    })
    .eq("id", academic.id);

  if (error) {
    alert(error.message);
    return;
  }

  setAcademic({
    ...academic,
    academic_year: form.academic_year,
    semester: form.semester,
  });
};


  if (loading) return <p style={styles.loading}>Loading...</p>;
  
  const addSignatory = () => {
  setSignatories([
    ...signatories,
    {
      name: "",
      position: "",
    },
  ]);
};

const removeSignatory = (index) => {
  setSignatories(
    signatories.filter((_, i) => i !== index)
  );
};

const updateSignatory = (index, field, value) => {
  const updated = [...signatories];

  updated[index][field] = value;

  setSignatories(updated);
};

const totalApplicants = applications.length;

const totalGrantees = scholarStats.reduce(
  (sum, s) => sum + (s.occupied || 0),
  0
);

const pendingApplications = applications.filter(
  (a) => a.status === "Pending"
).length;

const totalScholarships = scholarStats.length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
  <h1 style={styles.title}>
    Dashboard
  </h1>

  <div style={styles.headerRight}>

    <div style={styles.periodItem}>
  <label>AY</label>

  <input
    style={styles.periodInput}
    value={form.academic_year}
    onChange={(e) =>
      setForm({
        ...form,
        academic_year: e.target.value,
      })
    }
    onBlur={() => saveAcademic()}
  />
</div>

<div style={styles.periodItem}>
  <label>Semester</label>

  <select
    style={styles.periodInput}
    value={form.semester}
    onChange={async (e) => {
  const updatedForm = {
    ...form,
    semester: e.target.value,
  };

  setForm(updatedForm);

  if (!academic) return;

  const { error } = await supabase
    .from("academic_settings")
    .update({
      academic_year: updatedForm.academic_year,
      semester: updatedForm.semester,
      updated_at: new Date().toISOString(),
    })
    .eq("id", academic.id);

  if (error) {
    alert(error.message);
    return;
  }

  setAcademic(updatedForm);
}}
  >
    <option>1st Semester</option>
    <option>2nd Semester</option>
  </select>
</div>

    <button
      style={styles.btnGreen}
      onClick={() => setShowReportModal(true)}
    >
      Generate Report
    </button>

  </div>
</div>
<div style={styles.cardGrid}>

  <div style={styles.card}>
  <p style={styles.cardLabel}>Applications This Month</p>
  <h2 style={styles.cardValue}>
    {
      applications.filter(a => {
        const date = new Date(a.application_date);
        const now = new Date();
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }).length
    }
  </h2>
</div>

  <div style={styles.card}>
    <p style={styles.cardLabel}>Grantees</p>
    <h2 style={styles.cardValue}>{totalGrantees}</h2>
  </div>

  <div style={styles.card}>
  <p style={styles.cardLabel}>Acceptance Rate</p>
  <h2 style={styles.cardValue}>
    {
      totalApplicants
        ? Math.round(
            (applications.filter(a => a.status === "Approved").length /
              totalApplicants) *
              100
          )
        : 0
    }%
  </h2>
</div>

  <div style={styles.card}>
    <p style={styles.cardLabel}>Scholarships</p>
    <h2 style={styles.cardValue}>{totalScholarships}</h2>
  </div>

  

</div>


<div style={styles.infoGrid}>

  {/* Scholarship Count */}
  <div style={styles.infoCard}>
    <h3 style={styles.infoTitle}>Scholarships</h3>
     <div style={styles.cardContent}>
    {scholarStats.map((s) => (
  <div
    key={s.scholarship_id}
    style={styles.infoRow}
  >
    <span>{s.scholarship_name}</span>

    <span
      style={{
        ...styles.countBadge,
        background:
          s.occupied >= s.slots
            ? "#dc2626"
            : s.occupied >= s.slots * 0.8
            ? "#f59e0b"
            : "#16a34a",
      }}
    >
      {s.occupied} / {s.slots}
    </span>
  </div>
))}
</div>
  </div>

  {/* Upcoming Deadlines */}
  <div style={styles.infoCard}>
    <h3 style={styles.infoTitle}>
      Upcoming Deadlines
    </h3>
     <div style={styles.cardContent}>
      {upcomingDeadlines.map((d, index) => (
      <div key={index} style={styles.infoRow}>
        <span>{d.scholarship_name}</span>

        <span>
          {new Date(
            d.submission_deadline
          ).toLocaleDateString()}
        </span>
      </div>
    ))}</div>
  </div>

  {/* Recent Activity */}
  <div style={styles.infoCard}>
    <h3 style={styles.infoTitle}>
      Recent Activity
    </h3>
    <div style={styles.cardContent}>
    {applications.slice(0,5).map((a) => (
      <div
        key={a.application_id}
        style={styles.infoRow}
      >
        <span>
          {a.students?.users?.first_name}
        </span>

        <span>{a.status}</span>
      </div>
    ))}</div>
  </div>

  {/* Report Summary */}
  <div style={styles.infoCard}>
    <h3 style={styles.infoTitle}>
      Report Summary
    </h3>
     <div style={styles.cardContent}>
    <div style={styles.infoRow}>
      <span>Applications</span>

      <strong>{totalApplicants}</strong>
    </div>

    <div style={styles.infoRow}>
      <span>Approved</span>

      <strong>
        {
          applications.filter(
            a => a.status === "Approved"
          ).length
        }
      </strong>
    </div>

    <div style={styles.infoRow}>
      <span>Pending</span>

      <strong>{pendingApplications}</strong>
    </div>

    <div style={styles.infoRow}>
      <span>Rejected</span>

      <strong>
        {
          applications.filter(
            a => a.status === "Rejected"
          ).length
        }
      </strong>
    </div>
    </div>

  </div>

</div>
    
      {/* VIEW MODAL */}
{selectedApp && (
  <div
    style={styles.overlay}
    onClick={() => setSelectedApp(null)}
  >
    <div
      style={styles.modal}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 style={styles.modalTitle}>
        Application Details
      </h2>

      <div style={styles.studentCard}>
        <div>
          <strong>School ID</strong>
          <p>{selectedApp.students?.school_id}</p>
        </div>

        <div>
          <strong>Student</strong>
          <p>
            {selectedApp.students?.users?.first_name}{" "}
            {selectedApp.students?.users?.middle_name
              ? selectedApp.students.users.middle_name.charAt(0) + ". "
              : ""}
            {selectedApp.students?.users?.last_name}
          </p>
        </div>

        <div>
          <strong>Scholarship</strong>
          <p>{selectedApp.scholarships?.scholarship_name}</p>
        </div>

        <div>
          <strong>Status</strong>

          <span
            style={{
              ...styles.badge,
              background:
                selectedApp.status === "Pending"
                  ? "#FEF3C7"
                  : selectedApp.status === "Approved"
                  ? "#DCFCE7"
                  : "#FEE2E2",
              color:
                selectedApp.status === "Pending"
                  ? "#92400E"
                  : selectedApp.status === "Approved"
                  ? "#166534"
                  : "#991B1B",
            }}
          >
            {selectedApp.status}
          </span>
        </div>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3 style={{ marginBottom: 15 }}>
        Submitted Answers
      </h3>

      <div style={styles.answersContainer}>
        {answers.map((r, i) => (
          <div
            key={i}
            style={styles.answerCard}
          >
            <div style={styles.question}>
              {r.scholarship_form_fields?.label}
            </div>

            <div style={styles.answer}>
              {r.answer}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 20,
        }}
      >
        <button
          style={styles.btnRed}
          onClick={() => setSelectedApp(null)}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

      {showReportModal && (
  <div style={styles.overlay}>
    <div
      style={{
        background: "#fff",
        width: "900px",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: 20,
        borderRadius: 10,
      }}
    >
      <h2>Report Builder</h2>

      <hr />

      <h3>Layout</h3>

      <select
        value={reportLayout}
        onChange={(e) =>
          setReportLayout(e.target.value)
        }
      >
        <option value="portrait">
          Portrait
        </option>

        <option value="landscape">
          Landscape
        </option>
      </select>

      <h3>Filters</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2,1fr)",
          gap: 10,
        }}
      >
        <select
          value={reportFilters.reportType}
          onChange={(e) =>
            setReportFilters({
              ...reportFilters,
              reportType: e.target.value,
            })
          }
        >
          <option value="grantees">
            Grantees
          </option>

          <option value="applications">
            Applications
          </option>

          <option value="scholarships">
            Scholarships
          </option>
        </select>

        <select
  value={reportFilters.academicYear}
  onChange={(e) =>
    setReportFilters({
      ...reportFilters,
      academicYear: e.target.value,
    })
  }
>
  <option value="All">
    All Academic Years
  </option>

  {filterOptions.academicYears.map((ay) => (
    <option key={ay} value={ay}>
      {ay}
    </option>
  ))}
</select>

        <select
          value={reportFilters.semester}
          onChange={(e) =>
            setReportFilters({
              ...reportFilters,
              semester: e.target.value,
            })
          }
        >
          <option value="">
            All Semesters
          </option>

          <option>
            1st Semester
          </option>

          <option>
            2nd Semester
          </option>
        </select>

        <select
  value={reportFilters.scholarship}
  onChange={(e) =>
    setReportFilters({
      ...reportFilters,
      scholarship: e.target.value,
    })
  }
>
  <option value="All">
    All Scholarships
  </option>

  {filterOptions.scholarships.map((scholarship) => (
    <option
      key={scholarship}
      value={scholarship}
    >
      {scholarship}
    </option>
  ))}
</select>

<select
  value={reportFilters.status}
  onChange={(e) =>
    setReportFilters({
      ...reportFilters,
      status: e.target.value,
    })
  }
>
  <option value="All">
    All Statuses
  </option>

  {filterOptions.statuses.map((status) => (
    <option
      key={status}
      value={status}
    >
      {status}
    </option>
  ))}
</select>

        <select
  value={reportFilters.course}
  onChange={(e) =>
    setReportFilters({
      ...reportFilters,
      course: e.target.value,
    })
  }
>
  <option value="All">
    All Courses
  </option>

  {filterOptions.courses.map((course) => (
    <option
      key={course}
      value={course}
    >
      {course}
    </option>
  ))}
</select>

        <select
  value={reportFilters.yearLevel}
  onChange={(e) =>
    setReportFilters({
      ...reportFilters,
      yearLevel: e.target.value,
    })
  }
>
  <option value="All">
    All Year Levels
  </option>

  {filterOptions.yearLevels.map((level) => (
    <option
      key={level}
      value={level}
    >
      {level}
    </option>
  ))}
</select>
      </div>

      <h3>Columns</h3>

      {Object.keys(columns).map((key) => (
        <label
          key={key}
          style={{
            display: "block",
          }}
        >
          <input
            type="checkbox"
            checked={columns[key]}
            onChange={() =>
              setColumns({
                ...columns,
                [key]:
                  !columns[key],
              })
            }
          />

          {key}
        </label>
      ))}

      <h3>Signatories</h3>

      {signatories.map((s, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <input
            placeholder="Name"
            value={s.name}
            onChange={(e) =>
              updateSignatory(
                index,
                "name",
                e.target.value
              )
            }
          />

          <input
            placeholder="Position"
            value={s.position}
            onChange={(e) =>
              updateSignatory(
                index,
                "position",
                e.target.value
              )
            }
          />

          <button
            onClick={() =>
              removeSignatory(index)
            }
          >
            Delete
          </button>
        </div>
      ))}

      <button
        onClick={addSignatory}
      >
        Add Signatory
      </button>

      <hr />

      <h3>Preview</h3>

<div
  style={{
    border: "1px solid #ddd",
    background: "#fff",
    maxHeight: 350,
    overflow: "auto",
  }}
>
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
    }}
  >
    <thead>
      <tr>
        {columns.schoolId && <th>School ID</th>}
        {columns.studentName && <th>Student Name</th>}
        {columns.scholarship && <th>Scholarship</th>}
        {columns.course && <th>Course</th>}
        {columns.yearLevel && <th>Year Level</th>}
        {columns.academicYear && <th>Academic Year</th>}
        {columns.semester && <th>Semester</th>}
        {columns.status && <th>Status</th>}
      </tr>
    </thead>

    <tbody>
{filtered.map((a,index)=>(
<tr
    key={a.application_id}
    style={{
        background:index % 2 === 0
            ? "#fff"
            : "#f9fafb"
    }}
>
          {columns.schoolId && (
            <td>{a.students?.school_id}</td>
          )}

          {columns.studentName && (
            <td>
              {a.students?.users?.first_name}{" "}
              {a.students?.users?.last_name}
            </td>
          )}

          {columns.scholarship && (
            <td>
              {a.scholarships?.scholarship_name}
            </td>
          )}

          {columns.course && (
            <td>
              {a.students?.course || "-"}
            </td>
          )}

          {columns.yearLevel && (
            <td>
              {a.students?.year_level || "-"}
            </td>
          )}

          {columns.academicYear && (
            <td>{a.academic_year}</td>
          )}

          {columns.semester && (
            <td>{a.semester}</td>
          )}

          {columns.status && (
            <td>{a.status}</td>
          )}
        </tr>
      ))}
    </tbody>
  </table>
</div>

      <br />

      <div
        style={{
          display: "flex",
          gap: 10,
        }}
      >
        <button
  style={styles.btnGreen}
  onClick={generatePDF}
>
  Generate PDF
</button>

        <button
          style={styles.btnRed}
          onClick={() =>
            setShowReportModal(false)
          }
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

const styles = {
  container: {
    padding: 10,
  },

  header: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 30,
},

headerRight: {
  display: "flex",
  alignItems: "right",
  gap: 10,
},

cardGrid: {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
  marginBottom: 30,
},

card: {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,.08)",
},

cardLabel: {
  fontSize: 14,
  color: "#6b7280",
  marginBottom: 10,
},

cardValue: {
  fontSize: 32,
  fontWeight: "700",
  color: "#111827",
},
periodItem: {
  display: "flex",
  alignItems: "center",
  gap: 8,
},

periodInput: {
  padding: "6px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  minWidth: 150,
},

infoGrid: {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
  marginBottom: 30,
},

infoCard: {
  background: "#fff",
  borderRadius: 12,
  padding: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,.08)",
  height: 260,
  display: "flex",
  flexDirection: "column",
},

infoTitle: {
  marginBottom: 15,
  fontSize: 18,
  fontWeight: 600,
  color: "#475c6c",
},

infoRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid #eee",
},

countBadge: {
  background: "#475c6c",
  color: "#fff",
  borderRadius: 20,
  padding: "3px 10px",
  fontSize: 13,
  fontWeight: "600",
},
cardContent: {
  flex: 1,
  overflow: "auto",
  paddingRight: 6,
  scrollbarWidth: "none",
},

filterRow: {
  display: "flex",
  gap: 12,
  marginBottom: 20,
  flexWrap: "wrap",
},

searchInput: {
  flex: "0 0 320px",
  padding: "10px 14px",
  border: "1px solid #ddd",
  borderRadius: 8,
},

select: {
  minWidth: 180,
  padding: "10px",
  border: "1px solid #ddd",
  borderRadius: 8,
},
studentInfo: {
  display: "flex",
  flexDirection: "column",
},

studentName: {
  color: "#6b7280",
  fontSize: 13,
  marginTop: 2,
},

modalTitle: {
  marginBottom: 20,
},

studentCard: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 18,
  background: "#f9fafb",
  padding: 20,
  borderRadius: 10,
  marginBottom: 15,
},

answersContainer: {
  display: "flex",
  flexDirection: "column",
  gap: 15,
  maxHeight: 400,
  overflowY: "auto",
},

answerCard: {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 15,
  background: "#fff",
},

question: {
  fontWeight: "600",
  marginBottom: 8,
  color: "#374151",
},

answer: {
  color: "#4b5563",
  lineHeight: 1.6,
},
overlay: {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.45)",

  display: "flex",
  justifyContent: "center",
  alignItems: "center",

  zIndex: 9999,

  padding: 20,
},
modal: {
  background: "#fff",

  width: "100%",
  maxWidth: 900,

  maxHeight: "90vh",

  overflowY: "auto",

  borderRadius: 14,

  padding: 30,

  boxShadow: "0 15px 40px rgba(0,0,0,.25)",
},
answersContainer: {
  display: "flex",
  flexDirection: "column",
  gap: 15,

  maxHeight: 400,

  overflowY: "auto",

  scrollbarWidth: "none",

  msOverflowStyle: "none",
},
tableContainer: {
  width: "100%",
  overflowX: "auto",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 10px rgba(0,0,0,.08)",
  padding:10
},
table: {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
  fontSize: 14,
  background: "#fff",
  
},
th: {
  background: "#475c6c",
  color: "#fff",
  padding: "16px 18px",
  textAlign: "left",
  fontWeight: 600,
  whiteSpace: "nowrap",
},

td: {
  padding: "16px 18px",
  borderBottom: "1px solid #eef2f7",
  color: "#374151",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
},
actions: {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
},
pageButton: {
  padding: "8px 14px",
  border: "1px solid #475c6c",
  borderRadius: 8,
  background: "#475c6c",
  color: "#fff",
  cursor: "pointer",
},
 title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: "#475c6c",
  },
};