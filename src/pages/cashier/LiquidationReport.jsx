import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";
import { formatPeso, formatDate } from "@/lib/format";
import styles from "./LiquidationReport.module.css";

const TODAY = new Date().toISOString().split("T")[0];

export default function LiquidationReport() {
  const toast = useToast();

  const [scholarships,   setScholarships]   = useState([]);
  const [scholarshipId,  setScholarshipId]  = useState("");
  const [orNo,           setOrNo]           = useState("");
  const [projectName,    setProjectName]    = useState("");
  const [releaseAmount,  setReleaseAmount]  = useState("");
  const [prevAsOfDate,   setPrevAsOfDate]   = useState("");
  const [prevLiquidation, setPrevLiquidation] = useState("");
  const [asOfDate,       setAsOfDate]       = useState(TODAY);

  const [certifiedBy,  setCertifiedBy]  = useState({ name: "", title: "Accountant II" });
  const [reviewedBy,   setReviewedBy]   = useState({ name: "", title: "" });
  const [approvedBy,   setApprovedBy]   = useState({ name: "", title: "" });

  const [rows,          setRows]          = useState([]);
  const [loadingRows,   setLoadingRows]   = useState(false);
  const [calculating,   setCalculating]   = useState(false);
  const [generating,    setGenerating]    = useState(false);

  useEffect(() => { loadScholarships(); }, []);

  const loadScholarships = async () => {
    const { data } = await supabase
      .from("scholarships")
      .select("scholarship_id, scholarship_name, sponsor")
      .order("scholarship_name", { ascending: true });
    setScholarships(data || []);
  };

  const selectedScholarship = scholarships.find(s => String(s.scholarship_id) === String(scholarshipId));

  useEffect(() => {
    if (selectedScholarship && !projectName) setProjectName(selectedScholarship.scholarship_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarshipId]);

  // Pulls the disbursement rows for the current reporting window — every
  // Released fund_releases row for this scholarship's grantees, dated
  // after the previous report's cutoff and up to this report's "as of"
  // date. This is the real data behind both the "Liquidation" figure and
  // the Report of Disbursement table.
  const loadDisbursements = async () => {
    if (!scholarshipId || !asOfDate) { setRows([]); return; }
    setLoadingRows(true);

    let q = supabase
      .from("fund_releases")
      .select(`
        release_id, release_date, amount_released, check_no, dv_no, academic_year, semester,
        grantees!inner(scholarship_id, students(users(first_name, last_name)))
      `)
      .eq("status", "Released")
      .eq("grantees.scholarship_id", scholarshipId)
      .lte("release_date", asOfDate)
      .order("release_date", { ascending: true });

    if (prevAsOfDate) q = q.gt("release_date", prevAsOfDate);

    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoadingRows(false); return; }

    setRows((data || []).map(r => ({
      release_id: r.release_id,
      date: r.release_date,
      check_no: r.check_no || "",
      dv_no: r.dv_no || "",
      payee: `${r.grantees?.students?.users?.first_name || ""} ${r.grantees?.students?.users?.last_name || ""}`.trim() || "Unknown",
      account_name: `${projectName || selectedScholarship?.scholarship_name || ""} ${r.semester || ""} ${r.academic_year || ""}`.trim(),
      amount: Number(r.amount_released || 0),
    })));
    setLoadingRows(false);
  };

  useEffect(() => {
    loadDisbursements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarshipId, asOfDate, prevAsOfDate]);

  // Optional convenience: sums everything already Released for this
  // scholarship up to the previous report's date, as a starting point for
  // "Liquidation as of [previous date]" — she can still overwrite it if her
  // paper records say otherwise.
  const calculatePreviousLiquidation = async () => {
    if (!scholarshipId || !prevAsOfDate) {
      toast.error("Pick the scholarship and the previous report's date first.");
      return;
    }
    setCalculating(true);
    const { data, error } = await supabase
      .from("fund_releases")
      .select("amount_released, grantees!inner(scholarship_id)")
      .eq("status", "Released")
      .eq("grantees.scholarship_id", scholarshipId)
      .lte("release_date", prevAsOfDate);
    setCalculating(false);

    if (error) { toast.error(error.message); return; }
    const total = (data || []).reduce((sum, r) => sum + Number(r.amount_released || 0), 0);
    setPrevLiquidation(String(total));
    toast.success(`Calculated from ${data.length} release${data.length !== 1 ? "s" : ""} on record.`);
  };

  const currentLiquidation = rows.reduce((sum, r) => sum + r.amount, 0);
  const release = Number(releaseAmount || 0);
  const previousLiquidation = Number(prevLiquidation || 0);
  const endingBalance = release - previousLiquidation - currentLiquidation;

  const canGenerate =
    scholarshipId && orNo.trim() && projectName.trim() && releaseAmount !== "" && asOfDate;

  const getBase64Image = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const generatePdf = async () => {
    if (!canGenerate) {
      toast.error("Fill in the OR No., name of project, release amount, scholarship, and as-of date first.");
      return;
    }

    setGenerating(true);
    const headerImage = await getBase64Image("/header.png");
    const footerImage = await getBase64Image("/footer.png");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let headerHeight = 25;
    if (headerImage) {
      const imgProps = doc.getImageProperties(headerImage);
      headerHeight = Math.min((imgProps.height * pageWidth) / imgProps.width, 35);
      doc.addImage(headerImage, "PNG", 0, 0, pageWidth, headerHeight);
    }

    let y = headerHeight + 12;
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text("LIQUIDATION REPORT", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.text((selectedScholarship?.sponsor || selectedScholarship?.scholarship_name || "").toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.text(`As of ${formatDate(asOfDate)}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    // ── summary table ──
    autoTable(doc, {
      startY: y,
      head: [["Date", "OR No.", "Name of Project", "Release",
        `Liquidation\nAs of ${prevAsOfDate ? formatDate(prevAsOfDate) : "—"}`,
        "Liquidation", "Ending Balance"]],
      body: [[
        formatDate(asOfDate), orNo, projectName,
        formatPeso(release), formatPeso(previousLiquidation),
        formatPeso(currentLiquidation), formatPeso(endingBalance),
      ]],
      foot: [["", "", "TOTAL", formatPeso(release), formatPeso(previousLiquidation + currentLiquidation), "", formatPeso(endingBalance)]],
      styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle" },
      headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" },
      footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
      theme: "grid",
    });

    y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("REPORT OF DISBURSEMENT", pageWidth / 2, y, { align: "center" });
    y += 5;

    // ── disbursement table ──
    autoTable(doc, {
      startY: y,
      head: [["Date", "Check No./ADA/\nWeAccess No.", "Payroll #/\nDV No.", "Payee", "Account Name", "Amount"]],
      body: rows.map(r => [
        formatDate(r.date), r.check_no || "—", r.dv_no || "—", r.payee, r.account_name, formatPeso(r.amount),
      ]),
      foot: [["", "", "", "", "TOTAL", formatPeso(currentLiquidation)]],
      styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
      headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
      columnStyles: { 5: { halign: "right" } },
      theme: "grid",
      didDrawPage: () => {
        if (footerImage) {
          const pageHeight = doc.internal.pageSize.getHeight();
          const imgProps = doc.getImageProperties(footerImage);
          const footerHeight = Math.min((imgProps.height * pageWidth) / imgProps.width, 25);
          doc.addImage(footerImage, "PNG", 0, pageHeight - footerHeight, pageWidth, footerHeight);
        }
      },
    });

    // ── signature blocks ──
    y = doc.lastAutoTable.finalY + 20;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y > pageHeight - 60) { doc.addPage(); y = 30; }

    const colWidth = (pageWidth - 28) / 3;
    const blocks = [
      { label: "Certified Correct:", person: certifiedBy, x: 14 },
      { label: "Reviewed by:", person: reviewedBy, x: 14 + colWidth },
      { label: "Approved by:", person: approvedBy, x: 14 + colWidth * 2 },
    ];
    doc.setFontSize(9);
    blocks.forEach(b => {
      doc.setFont(undefined, "normal");
      doc.text(b.label, b.x, y);
      doc.line(b.x, y + 18, b.x + colWidth - 10, y + 18);
      doc.setFont(undefined, "bold");
      doc.text(b.person.name || "", b.x, y + 24);
      doc.setFont(undefined, "normal");
      doc.text(b.person.title || "", b.x, y + 29);
    });

    doc.save(`Liquidation_Report_${(projectName || "report").replace(/\s+/g, "_")}_${asOfDate}.pdf`);
    setGenerating(false);
    toast.success("Report downloaded.");
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Liquidation Report</h1>
          <p>Generate a sponsor liquidation report — release, disbursement, and remaining balance for a scholarship batch.</p>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.sectionTitle}>Batch Details</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Scholarship *</label>
            <select className={styles.select} value={scholarshipId} onChange={(e) => setScholarshipId(e.target.value)}>
              <option value="">Select scholarship…</option>
              {scholarships.map(s => (
                <option key={s.scholarship_id} value={s.scholarship_id}>{s.scholarship_name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>OR No. *</label>
            <input className={styles.input} value={orNo} onChange={(e) => setOrNo(e.target.value)} placeholder="e.g. 4604538" />
          </div>
          <div className={styles.field}>
            <label>Name of Project / Batch *</label>
            <input className={styles.input} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. CHED-TDP Batch 3.1" />
          </div>
          <div className={styles.field}>
            <label>Release Amount (₱) *</label>
            <input className={styles.input} type="number" value={releaseAmount} onChange={(e) => setReleaseAmount(e.target.value)}
              placeholder="Total funds received from sponsor for this batch" />
          </div>
        </div>

        <h3 className={styles.sectionTitle}>Reporting Period</h3>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Previous report — as of date</label>
            <input className={styles.input} type="date" value={prevAsOfDate} onChange={(e) => setPrevAsOfDate(e.target.value)} />
            <p className={styles.hint}>Leave blank if this is the first report for this batch.</p>
          </div>
          <div className={styles.field}>
            <label>Previous liquidation amount (₱)</label>
            <div className={styles.inlineRow}>
              <input className={styles.input} type="number" value={prevLiquidation} onChange={(e) => setPrevLiquidation(e.target.value)}
                placeholder="From your last report" />
              <button type="button" className={styles.calcBtn} disabled={calculating} onClick={calculatePreviousLiquidation}>
                {calculating ? "Calculating…" : "Calculate from records"}
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <label>This report — as of date *</label>
            <input className={styles.input} type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
        </div>

        <div className={styles.summaryStrip}>
          <div><span>Release</span><strong>{formatPeso(release)}</strong></div>
          <div><span>Prior Liquidation</span><strong>{formatPeso(previousLiquidation)}</strong></div>
          <div><span>This Period</span><strong>{formatPeso(currentLiquidation)}</strong></div>
          <div><span>Ending Balance</span><strong className={endingBalance < 0 ? styles.negative : ""}>{formatPeso(endingBalance)}</strong></div>
        </div>
        {endingBalance < 0 && (
          <p className={styles.warning}>
            Ending balance is negative — more has been liquidated than released. Double-check the release
            amount and previous liquidation figure.
          </p>
        )}

        <h3 className={styles.sectionTitle}>Report of Disbursement</h3>
        <p className={styles.hint}>
          Every Released payout for this scholarship in the reporting window above, pulled live from records.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th><th>Check No./ADA/WeAccess No.</th><th>Payroll #/DV No.</th>
                <th>Payee</th><th>Account Name</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr><td colSpan={6} className={styles.empty}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>
                  {scholarshipId ? "No releases found in this reporting window." : "Select a scholarship to see disbursements."}
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.release_id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.check_no || "—"}</td>
                  <td>{r.dv_no || "—"}</td>
                  <td>{r.payee}</td>
                  <td>{r.account_name}</td>
                  <td>{formatPeso(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.sectionTitle}>Signatories</h3>
        <div className={styles.grid}>
          {[["Certified Correct by", certifiedBy, setCertifiedBy],
            ["Reviewed by", reviewedBy, setReviewedBy],
            ["Approved by", approvedBy, setApprovedBy]].map(([label, val, setter]) => (
            <div key={label} className={styles.field}>
              <label>{label}</label>
              <input className={styles.input} value={val.name} onChange={(e) => setter(v => ({ ...v, name: e.target.value }))} placeholder="Name" />
              <input className={styles.input} style={{ marginTop: 6 }} value={val.title} onChange={(e) => setter(v => ({ ...v, title: e.target.value }))} placeholder="Title" />
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.generateBtn} disabled={!canGenerate || generating} onClick={generatePdf}>
            {generating ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
