import { useEffect, useMemo, useState } from "react";
import NumberInput from "@/components/ui/NumberInput";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { supabase } from "@/lib/supabase";
import { getReportSecurity } from "@/lib/reportSecurity";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/context/ToastContext";
import { formatPeso, formatMoneyPlain, formatDate } from "@/lib/format";
import styles from "./LiquidationReport.module.css";
import TableSkeleton from "@/components/ui/TableSkeleton";

const TODAY = new Date().toISOString().split("T")[0];
const SIGN_KEY = "liquidation-signatories-v1";

const DEFAULT_SIGN = {
  certifiedBy: { name: "", title: "Accountant II" },
  reviewedBy:  { name: "", title: "" },
  approvedBy:  { name: "", title: "" },
};

// Signatories rarely change between reports, so remember the last ones used.
// Browser storage can be unavailable, so every access is guarded.
function loadSigners() {
  try {
    const raw = localStorage.getItem(SIGN_KEY);
    return raw ? { ...DEFAULT_SIGN, ...JSON.parse(raw) } : DEFAULT_SIGN;
  } catch { return DEFAULT_SIGN; }
}

/**
 * Liquidation report.
 *
 * Only the OR No. (the official receipt) has to be typed in. Everything else
 * on the report card is generated from the system's own records:
 *   Date             = the "as of" date (defaults to today)
 *   Name of project  = the scholarship's name
 *   Release          = the scholarship's total budget
 *   Prior liquidation= every Released payout on or before the previous report's date
 *   Liquidation      = every Released payout in this reporting window
 *   Ending balance   = Release - Prior liquidation - Liquidation
 * "Adjust figures" lets her override the generated numbers when her paper
 * records say otherwise.
 */
export default function LiquidationReport() {
  const toast = useToast();

  const [scholarships,   setScholarships]   = useState([]);
  const [scholarshipId,  setScholarshipId]  = useState("");
  const [orNo,           setOrNo]           = useState("");
  const [asOfDate,       setAsOfDate]       = useState(TODAY);
  const [prevAsOfDate,   setPrevAsOfDate]   = useState("");

  // optional overrides ("" = use the generated value)
  const [showAdjust,      setShowAdjust]      = useState(false);
  const [projectOverride, setProjectOverride] = useState("");
  const [releaseOverride, setReleaseOverride] = useState("");
  const [priorOverride,   setPriorOverride]   = useState("");

  const [signers, setSigners] = useState(loadSigners);
  const { certifiedBy, reviewedBy, approvedBy } = signers;
  const setSigner = (key) => (fn) => setSigners(s => {
    const next = { ...s, [key]: typeof fn === "function" ? fn(s[key]) : fn };
    try { localStorage.setItem(SIGN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const [rows,          setRows]          = useState([]);
  const [loadingRows,   setLoadingRows]   = useState(false);
  const [priorAuto,     setPriorAuto]     = useState(0);
  const [generating,    setGenerating]    = useState(false);

  // Optional PDF password: the same shared export password the coordinator
  // uses (Settings > Report PDF password). Always starts unchecked, since
  // protecting an export is a per-report choice.
  const [reportSecurity, setReportSecurity] = useState(null);
  const [securePdf,      setSecurePdf]      = useState(false);
  useEffect(() => { getReportSecurity().then(setReportSecurity); }, []);

  useEffect(() => { loadScholarships(); }, []);

  const loadScholarships = async () => {
    const { data } = await supabase
      .from("scholarships")
      .select("scholarship_id, scholarship_name, sponsor, total_budget")
      .order("scholarship_name", { ascending: true });
    setScholarships(data || []);
  };

  const selectedScholarship = scholarships.find(s => String(s.scholarship_id) === String(scholarshipId));

  // ── generated values ───────────────────────────────────────
  const projectName = projectOverride.trim() || selectedScholarship?.scholarship_name || "";
  const generatedRelease = Number(selectedScholarship?.total_budget || 0);
  const release = releaseOverride !== "" ? Number(releaseOverride) : generatedRelease;

  // Every Released payout for this scholarship in the reporting window: after
  // the previous report's date (if any) and up to this report's "as of" date.
  useEffect(() => {
    let live = true;
    (async () => {
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
      if (!live) return;
      if (error) { toast.error(error.message); setLoadingRows(false); return; }
      setRows((data || []).map(r => ({
        release_id: r.release_id,
        date: r.release_date,
        check_no: r.check_no || "",
        dv_no: r.dv_no || "",
        payee: `${r.grantees?.students?.users?.first_name || ""} ${r.grantees?.students?.users?.last_name || ""}`.trim() || "Unknown",
        account_name: `${selectedScholarship?.scholarship_name || ""} ${r.semester || ""} ${r.academic_year || ""}`.trim(),
        amount: Number(r.amount_released || 0),
      })));
      setLoadingRows(false);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarshipId, asOfDate, prevAsOfDate, scholarships]);

  // Prior liquidation = everything already Released up to the previous report's date.
  useEffect(() => {
    let live = true;
    (async () => {
      if (!scholarshipId || !prevAsOfDate) { setPriorAuto(0); return; }
      const { data } = await supabase
        .from("fund_releases")
        .select("amount_released, grantees!inner(scholarship_id)")
        .eq("status", "Released")
        .eq("grantees.scholarship_id", scholarshipId)
        .lte("release_date", prevAsOfDate);
      if (live) setPriorAuto((data || []).reduce((sum, r) => sum + Number(r.amount_released || 0), 0));
    })();
    return () => { live = false; };
  }, [scholarshipId, prevAsOfDate]);

  const previousLiquidation = priorOverride !== "" ? Number(priorOverride) : priorAuto;
  const currentLiquidation  = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);
  const endingBalance       = release - previousLiquidation - currentLiquidation;

  const missing = [
    !scholarshipId && "choose a scholarship",
    scholarshipId && !orNo.trim() && "enter the OR No.",
    !asOfDate && "pick the as-of date",
  ].filter(Boolean);
  const canGenerate = missing.length === 0;

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
      toast.error("Choose a scholarship and enter the OR No. first.");
      return;
    }

    setGenerating(true);
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
    const headerImage = await getBase64Image("/header.png");
    const footerImage = await getBase64Image("/footer.png");
    const passwordProtect = securePdf && reportSecurity?.password;
    const doc = new jsPDF(passwordProtect ? {
      encryption: {
        userPassword: reportSecurity.password,
        ownerPassword: reportSecurity.password,
        userPermissions: ["print"],
      },
    } : undefined);
    const pageWidth = doc.internal.pageSize.getWidth();
    const MARGIN = 14;

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
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: pageWidth - MARGIN * 2,
      head: [["Date", "OR No.", "Name of Project", "Release",
        prevAsOfDate ? `Liquidation\nAs of ${formatDate(prevAsOfDate, { month: "short", day: "numeric", year: "numeric" })}` : "Prior\nLiquidation",
        "Liquidation", "Ending\nBalance"]],
      body: [[
        formatDate(asOfDate, { month: "short", day: "numeric", year: "numeric" }), orNo, projectName,
        formatMoneyPlain(release), formatMoneyPlain(previousLiquidation),
        formatMoneyPlain(currentLiquidation), formatMoneyPlain(endingBalance),
      ]],
      foot: [["", "", "TOTAL", formatMoneyPlain(release), "", formatMoneyPlain(previousLiquidation + currentLiquidation), formatMoneyPlain(endingBalance)]],
      columnStyles: {
        0: { cellWidth: 24 }, 1: { cellWidth: 20 }, 2: { cellWidth: "auto" },
        3: { cellWidth: 26, halign: "right" }, 4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 26, halign: "right" }, 6: { cellWidth: 26, halign: "right" },
      },
      styles: { fontSize: 8, cellPadding: 3, halign: "center", valign: "middle", overflow: "linebreak" },
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
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: pageWidth - MARGIN * 2,
      head: [["Date", "Check No./ADA/\nWeAccess No.", "Payroll #/\nDV No.", "Payee", "Account Name", "Amount"]],
      body: rows.map(r => [
        formatDate(r.date, { month: "short", day: "numeric", year: "numeric" }), r.check_no || "—", r.dv_no || "—", r.payee, r.account_name, formatMoneyPlain(r.amount),
      ]),
      foot: [["", "", "", "", "TOTAL", formatMoneyPlain(currentLiquidation)]],
      styles: { fontSize: 8, cellPadding: 3, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 24 }, 1: { cellWidth: 28 }, 2: { cellWidth: 26 },
        3: { cellWidth: 40 }, 4: { cellWidth: "auto" }, 5: { cellWidth: 28, halign: "right" },
      },
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

  const autoTag = <span className={styles.tagAuto}>Auto</span>;

  return (
    <div className={`page-shell ${styles.page}`}>
      <div className={`page-header ${styles.header}`}>
        <div>
          <h1 className="page-title">Liquidation Report</h1>
          <p className="page-subtitle">Pick a scholarship and enter the OR No. The rest of the report is filled in from your fund release records.</p>
        </div>
      </div>

      {/* 1 — what to report on */}
      <section className={styles.panel}>
        <h2 className={styles.step}><span>1</span> What are you reporting on?</h2>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Scholarship</label>
            <select className={styles.select} value={scholarshipId} onChange={(e) => setScholarshipId(e.target.value)}>
              <option value="">Select scholarship…</option>
              {scholarships.map(s => (
                <option key={s.scholarship_id} value={s.scholarship_id}>{s.scholarship_name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Report as of</label>
            <input className={styles.input} type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Previous report date <span className={styles.opt}>(optional)</span></label>
            <input className={styles.input} type="date" value={prevAsOfDate} max={asOfDate || undefined} onChange={(e) => setPrevAsOfDate(e.target.value)} />
            <p className={styles.hint}>Leave blank for the first report. Otherwise only payouts after this date are listed, and earlier ones count as prior liquidation.</p>
          </div>
        </div>
      </section>

      {/* 2 — the report card */}
      <section className={styles.panel}>
        <div className={styles.stepRow}>
          <h2 className={styles.step}><span>2</span> Report summary</h2>
          <InfoTooltip label="Report summary" align="left">
            Only the OR No. is typed in. Release is the scholarship's total budget, prior liquidation and liquidation are
            sums of Released payouts from your records, and the ending balance is Release − Prior liquidation − Liquidation.
          </InfoTooltip>
        </div>

        <div className={styles.cards}>
          <div className={`${styles.card} ${styles.cardManual}`}>
            <span className={styles.cardLabel}>OR No. <span className={styles.tagManual}>You enter</span></span>
            <input className={styles.orInput} value={orNo} onChange={(e) => setOrNo(e.target.value)}
              placeholder="e.g. 4604538" inputMode="numeric" aria-label="Official receipt number" />
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Date {autoTag}</span>
            <strong className={styles.cardValue}>{asOfDate ? formatDate(asOfDate) : "—"}</strong>
          </div>
          <div className={`${styles.card} ${styles.cardWide}`}>
            <span className={styles.cardLabel}>Name of project {autoTag}</span>
            <strong className={styles.cardValue}>{projectName || "—"}</strong>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Release {autoTag}</span>
            <strong className={styles.cardValue}>{formatPeso(release)}</strong>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Prior liquidation {autoTag}</span>
            <strong className={styles.cardValue}>{formatPeso(previousLiquidation)}</strong>
            <span className={styles.cardSub}>{prevAsOfDate ? `as of ${formatDate(prevAsOfDate)}` : "no previous report"}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Liquidation {autoTag}</span>
            <strong className={styles.cardValue}>{formatPeso(currentLiquidation)}</strong>
            <span className={styles.cardSub}>{rows.length} payout{rows.length !== 1 ? "s" : ""} this period</span>
          </div>
          <div className={`${styles.card} ${styles.cardEnd} ${endingBalance < 0 ? styles.cardNeg : ""}`}>
            <span className={styles.cardLabel}>Ending balance {autoTag}</span>
            <strong className={styles.cardValue}>{formatPeso(endingBalance)}</strong>
          </div>
        </div>

        {endingBalance < 0 && (
          <p className={styles.warning}>
            Ending balance is negative: more has been liquidated than released. Check the release amount and prior liquidation
            under "Adjust figures".
          </p>
        )}

        <button type="button" className={styles.linkBtn} onClick={() => setShowAdjust(v => !v)} aria-expanded={showAdjust}>
          {showAdjust ? "Hide adjustments" : "Adjust figures"}
        </button>
        {showAdjust && (
          <div className={styles.adjust}>
            <p className={styles.hint}>Only fill these in if your paper records differ. Leave blank to use the generated value.</p>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>Name of project</label>
                <input className={styles.input} value={projectOverride} onChange={(e) => setProjectOverride(e.target.value)}
                  placeholder={selectedScholarship?.scholarship_name || "e.g. CHED-TDP Batch 3.1"} />
              </div>
              <div className={styles.field}>
                <label>Release (₱)</label>
                <NumberInput className={styles.input} min={0} value={releaseOverride} onChange={(e) => setReleaseOverride(e.target.value)}
                  placeholder={String(generatedRelease)} />
              </div>
              <div className={styles.field}>
                <label>Prior liquidation (₱)</label>
                <NumberInput className={styles.input} min={0} value={priorOverride} onChange={(e) => setPriorOverride(e.target.value)}
                  placeholder={String(priorAuto)} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3 — disbursements */}
      <section className={styles.panel}>
        <div className={styles.stepRow}>
          <h2 className={styles.step}><span>3</span> Report of disbursement</h2>
          <InfoTooltip label="Report of disbursement" align="left">
            Every payout marked Released for this scholarship in the reporting window, pulled live from your fund release records.
          </InfoTooltip>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th><th>Check No./ADA/WeAccess No.</th><th>Payroll #/DV No.</th>
                <th>Payee</th><th>Account Name</th><th className={styles.num}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr><td colSpan={6} style={{ padding: "14px 16px" }}><TableSkeleton columns={6} rows={5} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>
                  {scholarshipId ? "No releases found in this reporting window." : "Choose a scholarship to see its disbursements."}
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.release_id}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.check_no || "—"}</td>
                  <td>{r.dv_no || "—"}</td>
                  <td className={styles.strong}>{r.payee}</td>
                  <td>{r.account_name}</td>
                  <td className={styles.num}>{formatPeso(r.amount)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr><td colSpan={5} className={styles.totalLbl}>Total</td><td className={`${styles.num} ${styles.strong}`}>{formatPeso(currentLiquidation)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* 4 — signatories */}
      <section className={styles.panel}>
        <div className={styles.stepRow}>
          <h2 className={styles.step}><span>4</span> Signatories</h2>
          <span className={styles.hint}>Remembered for next time.</span>
        </div>
        <div className={styles.grid}>
          {[["Certified correct by", certifiedBy, setSigner("certifiedBy")],
            ["Reviewed by", reviewedBy, setSigner("reviewedBy")],
            ["Approved by", approvedBy, setSigner("approvedBy")]].map(([label, val, setter]) => (
            <div key={label} className={styles.field}>
              <label>{label}</label>
              <input className={styles.input} value={val.name} onChange={(e) => setter(v => ({ ...v, name: e.target.value }))} placeholder="Name" />
              <input className={styles.input} value={val.title} onChange={(e) => setter(v => ({ ...v, title: e.target.value }))} placeholder="Title" />
            </div>
          ))}
        </div>
      </section>

      <div className={styles.actionBar}>
        {reportSecurity?.password ? (
          <label className={styles.secureToggle}>
            <input type="checkbox" checked={securePdf} onChange={(e) => setSecurePdf(e.target.checked)} />
            <Icon name="lock" size={14} /> Secure this PDF with a password
          </label>
        ) : (
          <span className={styles.actionHint}>No export password yet. Add one in Settings to protect PDFs.</span>
        )}
        <span className={styles.actionHint} style={{ marginLeft: "auto" }}>
          {canGenerate ? "Ready to download." : `To download: ${missing.join(" and ")}.`}
        </span>
        <button className={styles.generateBtn} disabled={!canGenerate || generating} onClick={generatePdf}>
          {generating ? "Generating…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
