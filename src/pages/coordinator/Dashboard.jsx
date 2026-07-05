import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AnnouncementModal from "@/components/ui/AnnouncementModal";

// ─── stable style objects defined outside the component ──────────────────────
const st = {
  container:   { padding: 10 },
  header:      { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:30, flexWrap:"wrap", gap:12 },
  headerRight: { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" },
  title:       { margin:0, fontSize:28, fontWeight:700, color:"var(--text-primary)" },
  periodItem:  { display:"flex", alignItems:"center", gap:8 },
  periodInput: { padding:"6px 10px", border:"1px solid var(--border-strong)", borderRadius:6, fontSize:14, minWidth:150, background:"var(--surface)", color:"var(--text-primary)" },
  cardGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:20, marginBottom:30 },
  card:        { background:"var(--surface)", borderRadius:12, padding:20, boxShadow:"var(--shadow-sm)", border:"1px solid var(--border)" },
  cardLabel:   { fontSize:14, color:"var(--text-secondary)", marginBottom:10 },
  cardValue:   { fontSize:32, fontWeight:700, color:"var(--text-primary)" },
  infoGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:20, marginBottom:30 },
  infoCard:    { background:"var(--surface)", borderRadius:12, padding:10, boxShadow:"var(--shadow-sm)", border:"1px solid var(--border)", height:260, display:"flex", flexDirection:"column" },
  infoTitle:   { marginBottom:15, fontSize:18, fontWeight:600, color:"var(--text-primary)", padding:"0 6px" },
  infoRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 6px", borderBottom:"1px solid var(--border)" },
  cardContent: { flex:1, overflow:"auto", paddingRight:6, scrollbarWidth:"none" },
  countBadge:  { borderRadius:20, padding:"3px 10px", fontSize:13, fontWeight:600, color:"#fff" },
  overlay:     { position:"fixed", inset:0, background:"rgba(10,21,32,.55)", backdropFilter:"blur(2px)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:9999, padding:20 },
  modal:       { background:"var(--surface)", width:"100%", maxWidth:900, maxHeight:"90vh", overflowY:"auto", borderRadius:16, boxShadow:"var(--shadow-xl)", border:"1px solid var(--border)", display:"flex", flexDirection:"column" },
  modalHead:   { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 28px", borderBottom:"1px solid var(--border)", flexShrink:0 },
  modalTitle:  { margin:0, fontSize:20, fontWeight:700, color:"var(--text-primary)" },
  modalBody:   { flex:1, overflowY:"auto", padding:"24px 28px", display:"flex", flexDirection:"column", gap:20 },
  modalFoot:   { display:"flex", justifyContent:"flex-end", gap:10, padding:"16px 28px", borderTop:"1px solid var(--border)", flexShrink:0 },
  closeBtn:    { width:32, height:32, border:"none", borderRadius:8, background:"var(--surface-muted)", color:"var(--text-secondary)", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  btnGreen:    { padding:"10px 18px", background:"#16a34a", color:"#fff", border:"none", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:14 },
  btnRed:      { padding:"10px 18px", background:"var(--surface)", color:"var(--text-primary)", border:"1px solid var(--border-strong)", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:14 },
  btnBlue:     { padding:"10px 18px", background:"var(--navy-600)", color:"#fff", border:"none", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:14 },
  btnSm:       { padding:"6px 12px", background:"var(--navy-600)", color:"#fff", border:"none", borderRadius:6, fontWeight:600, cursor:"pointer", fontSize:12 },
  sectionLabel:{ fontSize:12, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 },
  // form elements inside the modal — defined here so they never re-create in JSX
  sel:         { width:"100%", height:42, padding:"0 12px", background:"var(--surface)", color:"var(--text-primary)", border:"1px solid var(--border-strong)", borderRadius:8, fontSize:14, outline:"none" },
  inp:         { width:"100%", height:42, padding:"0 12px", boxSizing:"border-box", background:"var(--surface)", color:"var(--text-primary)", border:"1px solid var(--border-strong)", borderRadius:8, fontSize:14, outline:"none" },
  checkLabel:  { display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:"1px solid var(--border)", borderRadius:8, background:"var(--surface)", fontSize:14, color:"var(--text-primary)", cursor:"pointer" },
  previewWrap: { border:"1px solid var(--border)", borderRadius:10, overflow:"auto", maxHeight:280, background:"var(--surface)" },
  previewTable:{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:600 },
  previewTh:   { background:"var(--navy-900)", color:"#fff", padding:"10px 12px", textAlign:"left", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:".3px", whiteSpace:"nowrap" },
  previewTd:   { padding:"8px 12px", borderBottom:"1px solid var(--border)", color:"var(--text-primary)", verticalAlign:"middle" },
  sigRow:      { display:"flex", gap:8, alignItems:"center", marginBottom:8 },
  studentCard: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:18, background:"var(--surface-muted)", padding:20, borderRadius:10, marginBottom:15, border:"1px solid var(--border)" },
  badge:       { display:"inline-block", padding:"4px 12px", borderRadius:999, fontSize:12, fontWeight:600 },
  answersWrap: { display:"flex", flexDirection:"column", gap:12, maxHeight:400, overflowY:"auto", scrollbarWidth:"none" },
  answerCard:  { border:"1px solid var(--border)", borderRadius:8, padding:15, background:"var(--surface)" },
  question:    { fontWeight:600, marginBottom:8, color:"var(--text-primary)", fontSize:12, textTransform:"uppercase", letterSpacing:".3px" },
  answer:      { color:"var(--text-secondary)", lineHeight:1.6 },
};

const COLUMN_LABELS = {
  schoolId:     "School ID",
  studentName:  "Student Name",
  scholarship:  "Scholarship",
  course:       "Course",
  yearLevel:    "Year Level",
  academicYear: "Academic Year",
  semester:     "Semester",
  status:       "Status",
};

export default function CoordinatorDashboard() {
  const [applications,   setApplications]   = useState([]);
  const [selectedApp,    setSelectedApp]    = useState(null);
  const [answers,        setAnswers]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [academic,       setAcademic]       = useState(null);
  const [scholarStats,   setScholarStats]   = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [showReportModal,    setShowReportModal]    = useState(false);
  const [showAnnouncement,   setShowAnnouncement]   = useState(false);
  const [generating,     setGenerating]    = useState(false);
  const [form,           setForm]          = useState({ academic_year:"", semester:"" });
  const [reportLayout,   setReportLayout]  = useState("portrait");
  const [reportTitle,    setReportTitle]   = useState("SCHOLARSHIP REPORT");
  const [columns,        setColumns]       = useState({ schoolId:true, studentName:true, scholarship:true, course:true, yearLevel:true, academicYear:true, semester:true, status:true });
  const [signatories,    setSignatories]   = useState([{ label:"", name:"", position:"" }]);
  const [filterOptions,  setFilterOptions] = useState({ scholarships:[], courses:[], yearLevels:[], statuses:[], academicYears:[] });
  const [reportFilters,  setReportFilters] = useState({ academicYear:"All", semester:"All", scholarship:"All", course:"All", yearLevel:"All", status:"All" });

  useEffect(() => { load(); loadAcademic(); loadScholarStats(); loadUpcomingDeadlines(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("scholarship_applications").select(`
      application_id,status,application_date,scholarship_id,academic_year,semester,
      students(school_id,course,year_level,users(first_name,middle_name,last_name)),
      scholarships(scholarship_name)
    `).order("application_date",{ascending:false});
    setApplications(data||[]);
    const d = data||[];
    setFilterOptions({
      scholarships: [...new Set(d.map(a=>a.scholarships?.scholarship_name).filter(Boolean))],
      courses:      [...new Set(d.map(a=>a.students?.course).filter(Boolean))],
      yearLevels:   [...new Set(d.map(a=>a.students?.year_level).filter(Boolean))],
      statuses:     [...new Set(d.map(a=>a.status).filter(Boolean))],
      academicYears:[...new Set(d.map(a=>a.academic_year).filter(Boolean))],
    });
    setLoading(false);
  };

  const loadAcademic = async () => {
    const { data } = await supabase.from("academic_settings").select("*").order("updated_at",{ascending:false}).limit(1).single();
    if (data) { setAcademic(data); setForm({ academic_year:data.academic_year, semester:data.semester }); }
  };

  const loadScholarStats = async () => {
    const [{ data:scholarships }, { data:grantees }] = await Promise.all([
      supabase.from("scholarships").select("scholarship_id,scholarship_name,slots"),
      supabase.from("grantees").select("scholarship_id,status"),
    ]);
    setScholarStats((scholarships||[]).map(s=>({
      ...s, occupied:(grantees||[]).filter(g=>g.scholarship_id===s.scholarship_id&&g.status==="Active").length,
    })));
  };

  const loadUpcomingDeadlines = async () => {
    const { data } = await supabase.from("scholarships").select("scholarship_name,submission_deadline")
      .eq("status","Active").order("submission_deadline",{ascending:true}).limit(5);
    setUpcomingDeadlines(data||[]);
  };

  const saveAcademic = async () => {
    if (!academic) return;
    await supabase.from("academic_settings").update({ academic_year:form.academic_year, semester:form.semester, updated_at:new Date().toISOString() }).eq("id",academic.id);
    setAcademic({...academic,...form});
  };

  const saveSemester = async (val) => {
    const f = {...form,semester:val}; setForm(f);
    if (!academic) return;
    await supabase.from("academic_settings").update({ ...f, updated_at:new Date().toISOString() }).eq("id",academic.id);
    setAcademic({...academic,...f});
  };

  const viewAnswers = async (app) => {
    setSelectedApp(app);
    const { data } = await supabase.from("application_form_responses").select("answer,scholarship_form_fields(label)").eq("application_id",app.application_id);
    setAnswers(data||[]);
  };

  const updateSignatory = (i, field, value) => {
    const updated = signatories.map((s,idx)=>idx===i?{...s,[field]:value}:s);
    setSignatories(updated);
  };

  const filtered = applications.filter(a=>{
    if (reportFilters.scholarship!=="All" && a.scholarships?.scholarship_name!==reportFilters.scholarship) return false;
    if (reportFilters.course!=="All"      && a.students?.course!==reportFilters.course) return false;
    if (reportFilters.yearLevel!=="All"   && String(a.students?.year_level)!==reportFilters.yearLevel) return false;
    if (reportFilters.status!=="All"      && a.status!==reportFilters.status) return false;
    if (reportFilters.academicYear!=="All"&& a.academic_year!==reportFilters.academicYear) return false;
    if (reportFilters.semester && reportFilters.semester!=="All" && a.semester!==reportFilters.semester) return false;
    return true;
  });

  // ── PDF generation ────────────────────────────────────────────────────────
  const generatePDF = async () => {
    setGenerating(true);

    const isLandscape = reportLayout === "landscape";
    const doc = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait", unit: "mm" });

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    const NAVY  = [13,  43,  74];
    const GOLD  = [195, 158, 88];
    const WHITE = [255, 255, 255];
    const LIGHT = [243, 247, 251];
    const BODY  = [44,  62,  77];
    const MUTED = [100, 116, 132];

    const loadImg = (src) => new Promise(resolve => {
      const img = new Image(); img.src = src;
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
    });
    const [headerImg, footerImg] = await Promise.all([
      loadImg("/header.png"),
      loadImg("/footer.png"),
    ]);

    const HEADER_H = headerImg ? 30 : 22;
    const FOOTER_H = footerImg ? 18 : 14;

    // ── reusable header / footer ──────────────────────────────────────────
    const drawHeader = () => {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pw, HEADER_H, "F");

      if (headerImg) {
        // fill the full page width — same fix as footer
        doc.addImage(headerImg, "PNG", 0, 0, pw, HEADER_H);
      } else {
        doc.setTextColor(...WHITE);
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("SmartScholar", pw / 2, HEADER_H / 2 - 2, { align: "center" });
        doc.setFontSize(8);  doc.setFont("helvetica", "normal");
        doc.text("Scholarship Management System", pw / 2, HEADER_H / 2 + 4, { align: "center" });
      }

      doc.setFillColor(...GOLD);
      doc.rect(0, HEADER_H, pw, 1.2, "F");
    };

    const drawFooter = (pageNum) => {
      doc.setFillColor(...GOLD);
      doc.rect(0, ph - FOOTER_H - 1.2, pw, 1.2, "F");
      doc.setFillColor(...NAVY);
      doc.rect(0, ph - FOOTER_H, pw, FOOTER_H, "F");

      if (footerImg) {
        // fill the full page width
        doc.addImage(footerImg, "PNG", 0, ph - FOOTER_H, pw, FOOTER_H);
      } else {
        doc.setTextColor(...WHITE);
        doc.setFontSize(7); doc.setFont("helvetica", "normal");
        const dateStr = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
        doc.text(`Generated: ${dateStr}`, 8, ph - FOOTER_H / 2 + 2);
        doc.text("SmartScholar · For Official Use Only", pw / 2, ph - FOOTER_H / 2 + 2, { align: "center" });
      }

      // page number — bottom right, sitting just above the footer band
      doc.setTextColor(...NAVY);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(`Page ${pageNum}`, pw - 14, ph - FOOTER_H - 4, { align: "right" });
    };

    // ── cover block ───────────────────────────────────────────────────────
    drawHeader();
    drawFooter(1);

    const coverTitleY = HEADER_H + 22;

    // light background panel — smaller, no pills/stat boxes below it
    doc.setFillColor(...LIGHT);
    doc.rect(14, HEADER_H + 6, pw - 28, 24, "F");

    // main title
    doc.setTextColor(...NAVY);
    doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text(reportTitle || "SCHOLARSHIP REPORT", pw / 2, coverTitleY, { align: "center" });

    // gold underline
    const tw = doc.getTextWidth(reportTitle || "SCHOLARSHIP REPORT");
    doc.setDrawColor(...GOLD); doc.setLineWidth(1);
    doc.line(pw / 2 - tw / 2, coverTitleY + 2, pw / 2 + tw / 2, coverTitleY + 2);

    // subtitle (academic period)
    const subLine = [
      academic?.academic_year && `AY ${academic.academic_year}`,
      academic?.semester,
    ].filter(Boolean).join("  ·  ");
    if (subLine) {
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(subLine, pw / 2, coverTitleY + 10, { align: "center" });
    }

    // ── data table — starts right after the title block ───────────────────
    // # column always first, then the selected columns
    const SHORT_LABELS = {
      schoolId:     "School ID",
      studentName:  "Name",
      scholarship:  "Scholarship",
      course:       "Course",
      yearLevel:    "Year",
      academicYear: "Acad. Year",
      semester:     "Semester",
      status:       "Status",
    };
    const headers = ["#", ...Object.entries(SHORT_LABELS).filter(([k]) => columns[k]).map(([, v]) => v)];
    const rows = filtered.map((a, idx) => {
      const row = [String(idx + 1)];
      if (columns.schoolId)     row.push(a.students?.school_id || "—");
      if (columns.studentName)  row.push(`${a.students?.users?.first_name || ""} ${a.students?.users?.last_name || ""}`.trim() || "—");
      if (columns.scholarship)  row.push(a.scholarships?.scholarship_name || "—");
      if (columns.course)       row.push(a.students?.course || "—");
      if (columns.yearLevel)    row.push(String(a.students?.year_level || "—"));
      if (columns.academicYear) row.push(a.academic_year || "—");
      if (columns.semester)     row.push(a.semester || "—");
      if (columns.status)       row.push(a.status || "—");
      return row;
    });

    const statusColIdx = headers.indexOf("Status");

    autoTable(doc, {
      head:   [headers],
      body:   rows,
      startY: HEADER_H + 38,
      margin: { top: HEADER_H + 3, bottom: FOOTER_H + 6, left: 14, right: 14 },
      styles: {
        fontSize:     8.5,
        cellPadding:  { top: 5, bottom: 5, left: 5, right: 5 },
        textColor:    BODY,
        lineColor:    [210, 220, 228],
        lineWidth:    0.18,
        font:         "helvetica",
        overflow:     "linebreak",
        minCellWidth: 18,
      },
      headStyles: {
        fillColor:   NAVY,
        textColor:   WHITE,
        fontStyle:   "bold",
        fontSize:    7.5,
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
      },
      alternateRowStyles: { fillColor: LIGHT },
      // # column — narrow and centered
      columnStyles: {
        0: { halign: "center", cellWidth: 10, textColor: MUTED },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === statusColIdx && statusColIdx !== -1) {
          const val = data.cell.raw;
          data.cell.styles.fontStyle = "bold";
          if      (val === "Approved") data.cell.styles.textColor = [22,  163, 74];
          else if (val === "Rejected") data.cell.styles.textColor = [220, 38,  38];
          else if (val === "Pending")  data.cell.styles.textColor = [217, 119, 6];
          else if (val === "Active")   data.cell.styles.textColor = [22,  163, 74];
          else                         data.cell.styles.textColor = MUTED;
        }
      },
      didDrawPage: (data) => {
        drawHeader();
        drawFooter(data.pageNumber);
      },
    });

    const ay  = academic?.academic_year?.replace(/[^a-zA-Z0-9]/g, "_") || "Report";
    const sem = academic?.semester?.replace(/\s+/g, "_") || "";

    // ── Signatories (only if at least one has content) ────────────────────
    const validSigs = signatories.filter(s => s.name.trim() || s.position.trim());
    if (validSigs.length > 0) {
      let y = (doc.lastAutoTable.finalY || 140) + 14;

      if (y + 45 > ph - FOOTER_H - 10) {
        doc.addPage();
        drawHeader();
        drawFooter(doc.internal.getNumberOfPages());
        y = HEADER_H + 20;
      }

      // Each signatory gets a fixed-width column starting from the left.
      // Max 3 per row so they never get too narrow.
      const COL_W    = 60;   // mm per signatory column
      const LINE_W   = 52;   // width of the signature line
      const SIG_H    = 18;   // blank space above the line for the actual signature

      validSigs.forEach((sig, i) => {
        const x = 14 + i * (COL_W + 4);

        // Label (e.g. "Prepared by") — small caps above everything
        if (sig.label) {
          doc.setTextColor(...MUTED);
          doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
          doc.text(sig.label.toUpperCase(), x, y);
        }

        // Blank space for the actual handwritten signature
        // (SIG_H mm of empty space between label and the line)
        const lineY = y + SIG_H;

        // Signature line — only if name is provided
        if (sig.name.trim()) {
          doc.setDrawColor(...NAVY);
          doc.setLineWidth(0.5);
          doc.line(x, lineY, x + LINE_W, lineY);
        }

        // Name — bold, left-aligned, just below the line
        if (sig.name.trim()) {
          doc.setTextColor(...NAVY);
          doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
          doc.text(sig.name.toUpperCase(), x, lineY + 5);
        }

        // Position — muted, left-aligned, below the name
        if (sig.position.trim()) {
          doc.setTextColor(...BODY);
          doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
          doc.text(sig.position, x, lineY + 11);
        }
      });
    }

    doc.save(`SmartScholar_Report_${ay}${sem ? "_" + sem : ""}.pdf`);
    setGenerating(false);
  };

  const totalApplicants   = applications.length;
  const totalGrantees     = scholarStats.reduce((s,x)=>s+(x.occupied||0),0);
  const pendingCount      = applications.filter(a=>a.status==="Pending").length;
  const totalScholarships = scholarStats.length;

  if (loading) return <p style={{padding:20,color:"var(--text-secondary)"}}>Loading...</p>;

  return (
    <div style={st.container}>
      {/* ── header ── */}
      <div style={st.header}>
        <h1 style={st.title}>Dashboard</h1>
        <div style={st.headerRight}>
          <div style={st.periodItem}>
            <label style={{fontSize:13,color:"var(--text-secondary)"}}>AY</label>
            <input style={st.periodInput} value={form.academic_year}
              onChange={e=>setForm({...form,academic_year:e.target.value})}
              onBlur={saveAcademic} />
          </div>
          <div style={st.periodItem}>
            <label style={{fontSize:13,color:"var(--text-secondary)"}}>Semester</label>
            <select style={st.periodInput} value={form.semester} onChange={e=>saveSemester(e.target.value)}>
              <option>1st Semester</option>
              <option>2nd Semester</option>
            </select>
          </div>
          <button style={st.btnGreen} onClick={()=>setShowReportModal(true)}>
            Generate Report
          </button>
          <button style={{...st.btnGreen, background:"var(--navy-700)"}} onClick={()=>setShowAnnouncement(true)}>
            Announcements
          </button>
        </div>
      </div>

      {/* ── stat cards ── */}
      <div style={st.cardGrid}>
        {[
          ["Applications This Month", applications.filter(a=>{const d=new Date(a.application_date),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()}).length],
          ["Grantees", totalGrantees],
          ["Acceptance Rate", totalApplicants ? Math.round(applications.filter(a=>a.status==="Approved").length/totalApplicants*100)+"%" : "0%"],
          ["Scholarships", totalScholarships],
        ].map(([label,val])=>(
          <div key={label} style={st.card}>
            <p style={st.cardLabel}>{label}</p>
            <h2 style={st.cardValue}>{val}</h2>
          </div>
        ))}
      </div>

      {/* ── info grid ── */}
      <div style={st.infoGrid}>
        <div style={st.infoCard}>
          <h3 style={st.infoTitle}>Scholarship Slots</h3>
          <div style={st.cardContent}>
            {scholarStats.map(s=>(
              <div key={s.scholarship_id} style={st.infoRow}>
                <span style={{fontSize:13,color:"var(--text-primary)"}}>{s.scholarship_name}</span>
                <span style={{...st.countBadge, background:s.occupied>=s.slots?"#dc2626":s.occupied>=s.slots*.8?"#d97706":"#16a34a"}}>
                  {s.occupied}/{s.slots}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={st.infoCard}>
          <h3 style={st.infoTitle}>Upcoming Deadlines</h3>
          <div style={st.cardContent}>
            {upcomingDeadlines.map((d,i)=>(
              <div key={i} style={st.infoRow}>
                <span style={{fontSize:13,color:"var(--text-primary)"}}>{d.scholarship_name}</span>
                <span style={{fontSize:12,color:"var(--text-secondary)"}}>{new Date(d.submission_deadline).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={st.infoCard}>
          <h3 style={st.infoTitle}>Recent Activity</h3>
          <div style={st.cardContent}>
            {applications.slice(0,5).map(a=>(
              <div key={a.application_id} style={st.infoRow}>
                <span style={{fontSize:13,color:"var(--text-primary)"}}>{a.students?.users?.first_name} {a.students?.users?.last_name}</span>
                <span style={{fontSize:12,color:"var(--text-secondary)"}}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={st.infoCard}>
          <h3 style={st.infoTitle}>Summary</h3>
          <div style={st.cardContent}>
            {[["Total",totalApplicants],["Approved",applications.filter(a=>a.status==="Approved").length],["Pending",pendingCount],["Rejected",applications.filter(a=>a.status==="Rejected").length]].map(([l,v])=>(
              <div key={l} style={st.infoRow}>
                <span style={{fontSize:13,color:"var(--text-primary)"}}>{l}</span>
                <strong style={{color:"var(--text-primary)"}}>{v}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── View answers modal ── */}
      {selectedApp && (
        <div style={st.overlay} onMouseDown={e=>e.target===e.currentTarget&&setSelectedApp(null)}>
          <div style={{...st.modal,maxWidth:640}}>
            <div style={st.modalHead}>
              <h2 style={st.modalTitle}>Application Details</h2>
              <button style={st.closeBtn} onClick={()=>setSelectedApp(null)}>✕</button>
            </div>
            <div style={st.modalBody}>
              <div style={st.studentCard}>
                {[["School ID",selectedApp.students?.school_id],["Student",`${selectedApp.students?.users?.first_name||""} ${selectedApp.students?.users?.middle_name?selectedApp.students.users.middle_name.charAt(0)+". ":""}${selectedApp.students?.users?.last_name||""}`],["Scholarship",selectedApp.scholarships?.scholarship_name]].map(([l,v])=>(
                  <div key={l}><strong style={{fontSize:11,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px"}}>{l}</strong><p style={{margin:"4px 0 0",color:"var(--text-primary)"}}>{v}</p></div>
                ))}
                <div>
                  <strong style={{fontSize:11,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px"}}>Status</strong>
                  <p style={{margin:"4px 0 0"}}>
                    <span style={{...st.badge,background:selectedApp.status==="Approved"?"var(--success-100)":selectedApp.status==="Rejected"?"var(--danger-100)":"var(--warning-100)",color:selectedApp.status==="Approved"?"var(--success-700)":selectedApp.status==="Rejected"?"var(--danger-700)":"var(--warning-700)"}}>
                      {selectedApp.status}
                    </span>
                  </p>
                </div>
              </div>
              <h3 style={{margin:0,color:"var(--text-primary)"}}>Submitted Answers</h3>
              <div style={st.answersWrap}>
                {answers.map((r,i)=>(
                  <div key={i} style={st.answerCard}>
                    <div style={st.question}>{r.scholarship_form_fields?.label}</div>
                    <div style={st.answer}>{r.answer}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={st.modalFoot}>
              <button style={st.btnRed} onClick={()=>setSelectedApp(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report modal ── */}
      {showReportModal && (
        <div style={st.overlay} onMouseDown={e=>e.target===e.currentTarget&&setShowReportModal(false)}>
          <div style={st.modal}>
            <div style={st.modalHead}>
              <div>
                <h2 style={st.modalTitle}>Generate Report</h2>
                <p style={{margin:0,fontSize:13,color:"var(--text-secondary)"}}>Customize filters and columns, then export to PDF.</p>
              </div>
              <button style={st.closeBtn} onClick={()=>setShowReportModal(false)}>✕</button>
            </div>

            <div style={st.modalBody}>

              {/* Report Title */}
              <div>
                <p style={st.sectionLabel}>Report Title</p>
                <input
                  style={{...st.inp, fontSize:15, fontWeight:600}}
                  value={reportTitle}
                  placeholder="e.g. Grantees Report — 1st Semester"
                  onChange={e => setReportTitle(e.target.value)}
                />
              </div>

              {/* Layout */}
              <div>
                <p style={st.sectionLabel}>Page Orientation</p>
                <div style={{display:"flex", gap:8}}>
                  {[["portrait","⬜ Portrait"],["landscape","⬛ Landscape"]].map(([v,label])=>(
                    <button key={v} onClick={()=>setReportLayout(v)} style={{
                      padding:"10px 20px",
                      borderRadius:8,
                      border: reportLayout===v ? "2px solid var(--navy-600)" : "1px solid var(--border-strong)",
                      background: reportLayout===v ? "var(--navy-50)" : "var(--surface)",
                      color: reportLayout===v ? "var(--navy-700)" : "var(--text-primary)",
                      fontWeight: reportLayout===v ? 700 : 500,
                      fontSize:14, cursor:"pointer",
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div>
                <p style={st.sectionLabel}>Filters</p>
                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10}}>
                  {[
                    ["Academic Year", "academicYear", ["All",...filterOptions.academicYears]],
                    ["Semester",      "semester",     ["All","1st Semester","2nd Semester"]],
                    ["Scholarship",   "scholarship",  ["All",...filterOptions.scholarships]],
                    ["Status",        "status",       ["All",...filterOptions.statuses]],
                    ["Course",        "course",       ["All",...filterOptions.courses]],
                    ["Year Level",    "yearLevel",    ["All",...filterOptions.yearLevels]],
                  ].map(([label,key,opts])=>(
                    <div key={key}>
                      <label style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".3px"}}>{label}</label>
                      <select style={st.sel} value={reportFilters[key]}
                        onChange={e=>setReportFilters({...reportFilters,[key]:e.target.value})}>
                        {opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div>
                <p style={st.sectionLabel}>Columns to include</p>
                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:8}}>
                  {Object.entries(COLUMN_LABELS).map(([key,label])=>(
                    <label key={key} style={{
                      ...st.checkLabel,
                      background:   columns[key] ? "var(--navy-50)"  : "var(--surface)",
                      borderColor:  columns[key] ? "var(--navy-300)" : "var(--border)",
                      fontWeight:   columns[key] ? 600 : 400,
                      color:        columns[key] ? "var(--navy-700)" : "var(--text-primary)",
                    }}>
                      <input type="checkbox" checked={columns[key]} onChange={()=>setColumns({...columns,[key]:!columns[key]})} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Signatories */}
              <div>
                <p style={st.sectionLabel}>Signatories <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"var(--text-secondary)"}}>— leave blank to omit from PDF</span></p>
                <div style={{display:"grid", gridTemplateColumns:`repeat(${signatories.length}, 1fr)`, gap:12, marginBottom:10}}>
                  {signatories.map((sig,i)=>(
                    <div key={i} style={{display:"flex",flexDirection:"column",gap:6,background:"var(--surface-muted)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",position:"relative"}}>
                      {signatories.length>1 && (
                        <button onClick={()=>setSignatories(signatories.filter((_,idx)=>idx!==i))}
                          style={{position:"absolute",top:8,right:8,width:22,height:22,background:"var(--danger-50)",color:"var(--danger-700)",border:"1px solid var(--danger-100)",borderRadius:6,cursor:"pointer",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>
                          ✕
                        </button>
                      )}
                      <div>
                        <label style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px",display:"block",marginBottom:4}}>Label</label>
                        <select style={{...st.inp,height:38,fontSize:13}} value={sig.label}
                          onChange={e=>updateSignatory(i,"label",e.target.value)}>
                          <option value="">Select label…</option>
                          <option value="Prepared by">Prepared by</option>
                          <option value="Reviewed by">Reviewed by</option>
                          <option value="Approved by">Approved by</option>
                          <option value="Certified by">Certified by</option>
                          <option value="Noted by">Noted by</option>
                          <option value="Verified by">Verified by</option>
                        </select>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px",display:"block",marginBottom:4}}>Full Name</label>
                        <input style={{...st.inp,height:38,fontSize:13}} placeholder="e.g. Juan Dela Cruz" value={sig.name}
                          onChange={e=>updateSignatory(i,"name",e.target.value)} />
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px",display:"block",marginBottom:4}}>Position / Title</label>
                        <input style={{...st.inp,height:38,fontSize:13}} placeholder="e.g. Scholarship Coordinator" value={sig.position}
                          onChange={e=>updateSignatory(i,"position",e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setSignatories([...signatories,{label:"",name:"",position:""}])}
                  style={{padding:"7px 14px",background:"var(--gold-50)",color:"var(--gold-700)",border:"1px solid var(--gold-100)",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13}}>
                  + Add Signatory
                </button>
              </div>

              {/* Live preview */}
              <div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
                  <p style={{...st.sectionLabel, margin:0}}>
                    Preview
                    <span style={{marginLeft:8, fontWeight:400, textTransform:"none", letterSpacing:0, color:"var(--text-secondary)"}}>
                      — {filtered.length} record{filtered.length!==1?"s":""}
                    </span>
                  </p>
                </div>
                <div style={st.previewWrap}>
                  <table style={st.previewTable}>
                    <thead>
                      <tr>
                        {Object.entries(COLUMN_LABELS).filter(([k])=>columns[k]).map(([,l])=>(
                          <th key={l} style={st.previewTh}>{l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0,8).map((a,i)=>(
                        <tr key={a.application_id} style={{background:i%2===0?"var(--surface)":"var(--surface-muted)"}}>
                          {columns.schoolId     && <td style={st.previewTd}>{a.students?.school_id||"—"}</td>}
                          {columns.studentName  && <td style={st.previewTd}>{a.students?.users?.first_name} {a.students?.users?.last_name}</td>}
                          {columns.scholarship  && <td style={st.previewTd}>{a.scholarships?.scholarship_name||"—"}</td>}
                          {columns.course       && <td style={st.previewTd}>{a.students?.course||"—"}</td>}
                          {columns.yearLevel    && <td style={st.previewTd}>{a.students?.year_level||"—"}</td>}
                          {columns.academicYear && <td style={st.previewTd}>{a.academic_year||"—"}</td>}
                          {columns.semester     && <td style={st.previewTd}>{a.semester||"—"}</td>}
                          {columns.status       && (
                            <td style={st.previewTd}>
                              <span style={{
                                padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700,
                                background: a.status==="Approved"?"var(--success-100)": a.status==="Rejected"?"var(--danger-100)": a.status==="Pending"?"var(--warning-100)":"var(--ink-100)",
                                color:      a.status==="Approved"?"var(--success-700)": a.status==="Rejected"?"var(--danger-700)": a.status==="Pending"?"var(--warning-700)":"var(--ink-600)",
                              }}>
                                {a.status}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                      {filtered.length===0 && (
                        <tr>
                          <td colSpan={Object.values(columns).filter(Boolean).length}
                            style={{...st.previewTd, textAlign:"center", color:"var(--text-secondary)", padding:28}}>
                            No records match these filters
                          </td>
                        </tr>
                      )}
                      {filtered.length>8 && (
                        <tr>
                          <td colSpan={Object.values(columns).filter(Boolean).length}
                            style={{...st.previewTd, textAlign:"center", color:"var(--text-secondary)", fontStyle:"italic", fontSize:12}}>
                            …and {filtered.length-8} more row{filtered.length-8!==1?"s":""}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <div style={st.modalFoot}>
              <button style={st.btnRed} onClick={()=>setShowReportModal(false)} disabled={generating}>
                Cancel
              </button>
              <button
                style={{...st.btnBlue, opacity: generating||filtered.length===0 ? .55 : 1, cursor: generating||filtered.length===0 ? "not-allowed" : "pointer"}}
                onClick={generatePDF}
                disabled={generating||filtered.length===0}
              >
                {generating ? "Generating…" : `Export PDF  (${filtered.length} record${filtered.length!==1?"s":""})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnnouncementModal
        open={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
      />
    </div>
  );
}
