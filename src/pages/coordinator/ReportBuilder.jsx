import { useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportBuilder() {
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    type: "grantees", // grantees | applications | scholarships
    status: "All",
    academic_year: "",
    semester: "",
  });

  const [layout, setLayout] = useState("portrait"); // portrait | landscape

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

    const fetchData = async () => {
    let query;

    if (filters.type === "grantees") {
      query = supabase.from("grantees").select(`
        grantee_id,
        status,
        academic_year,
        semester,
        date_awarded,
        students (
          school_id,
          users (first_name, last_name)
        ),
        scholarships (scholarship_name)
      `);
    }

    if (filters.type === "applications") {
      query = supabase.from("scholarship_applications").select(`
        application_id,
        status,
        application_date,
        students (student_id, users (first_name, last_name)),
        scholarships (scholarship_name)
      `);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return [];
    }

    return data || [];
  };

    const generateReport = async () => {
    setLoading(true);

    const data = await fetchData();

    const doc = new jsPDF({
      orientation: layout,
    });

    doc.setFontSize(14);
    doc.text("SMART SCHOLAR REPORT", 14, 15);

    doc.setFontSize(10);
    doc.text(`Type: ${filters.type}`, 14, 22);
    doc.text(`Status: ${filters.status}`, 14, 28);

    let rows = [];

    if (filters.type === "grantees") {
      rows = data.map((g, i) => [
        i + 1,
        g.students?.users?.first_name + " " + g.students?.users?.last_name,
        g.scholarships?.scholarship_name,
        g.academic_year,
        g.semester,
        g.status,
      ]);
    }

    if (filters.type === "applications") {
      rows = data.map((a, i) => [
        i + 1,
        a.students?.users?.first_name + " " + a.students?.users?.last_name,
        a.scholarships?.scholarship_name,
        a.status,
        new Date(a.application_date).toLocaleDateString(),
      ]);
    }

    autoTable(doc, {
      startY: 35,
      head:
        filters.type === "grantees"
          ? [["#", "Student", "Scholarship", "AY", "Sem", "Status"]]
          : [["#", "Student", "Scholarship", "Status", "Date"]],
      body: rows,
    });

    doc.save(`${filters.type}_report.pdf`);

    setLoading(false);
  };

    return (
    <div style={{ padding: 20 }}>
      <h2>Report Builder</h2>

      {/* TYPE */}
      <label>Report Type</label>
      <select name="type" onChange={handleChange}>
        <option value="grantees">Grantees</option>
        <option value="applications">Applications</option>
      </select>

      {/* STATUS FILTER */}
      <label>Status</label>
      <select name="status" onChange={handleChange}>
        <option>All</option>
        <option>Pending</option>
        <option>Approved</option>
        <option>Rejected</option>
        <option>Active</option>
      </select>

      {/* AY */}
      <input
        name="academic_year"
        placeholder="Academic Year"
        onChange={handleChange}
      />

      {/* SEM */}
      <select name="semester" onChange={handleChange}>
        <option value="">All Semesters</option>
        <option>1st Semester</option>
        <option>2nd Semester</option>
      </select>

      {/* LAYOUT */}
      <select value={layout} onChange={(e) => setLayout(e.target.value)}>
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>

      <br /><br />

      <button onClick={generateReport} disabled={loading}>
        {loading ? "Generating..." : "Generate PDF"}
      </button>
    </div>
  );
}