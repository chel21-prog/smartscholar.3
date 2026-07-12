import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge, EmptyState } from "@/components/ui/Card";
import { TableWrap, Table } from "@/components/ui/Table";
import uiStyles from "@/components/ui/ui.module.css";
import PageLoader from "@/components/ui/PageLoader";
import s from "./Dashboard.module.css";

export default function Dashboard() {
  const [scholarships,   setScholarships]   = useState([]);
  const [requirementsMap,setRequirementsMap] = useState([]);
  const [eligibilityDefs,setEligibilityDefs] = useState([]); // id -> requirement_name lookup
  const [studentReq,     setStudentReq]     = useState([]);
  const [studentId,      setStudentId]      = useState(null);
  const [studentProfile, setStudentProfile] = useState(null); // { course, year_level }
  const [loading,        setLoading]        = useState(true);
  const [applications,   setApplications]   = useState([]);
  const [academic,       setAcademic]       = useState(null);
  const [sortMode,       setSortMode]       = useState("best"); // best | amount | convenience

  // apply modal
  const [showForm,            setShowForm]           = useState(false);
  const [selectedScholarship, setSelectedScholarship]= useState(null);
  const [formMeta,            setFormMeta]           = useState(null);
  const [formFields,          setFormFields]         = useState([]);
  const [formAnswers,         setFormAnswers]        = useState({});
  // file fields: store the File object here, upload on submit, then store the URL as the answer
  const [fileAnswers,         setFileAnswers]        = useState({});
  const [uploadingFields,     setUploadingFields]    = useState(new Set());
  const [submitting,          setSubmitting]         = useState(false);
  const [formError,           setFormError]          = useState("");
  const [formLoading,         setFormLoading]        = useState(false);

  // keep a ref to answers so submitApplication always sees the latest
  // without needing to close over stale state
  const answersRef = useRef({});
  answersRef.current = formAnswers;

  useEffect(() => { load(); loadAcademic(); }, []);

  // ── Escape key closes modal ──────────────────────────────
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e) => { if (e.key === "Escape") closeApply(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

  // ── data ────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data: userRow } = await supabase
        .from("users").select("user_id").eq("auth_id", user.id).single();

      const { data: studentRow } = await supabase
        .from("students").select("student_id, course, year_level").eq("user_id", userRow.user_id).single();

      const sid = studentRow.student_id;
      setStudentId(sid);
      setStudentProfile({ course: studentRow.course, year_level: studentRow.year_level });

      const [{ data: appData }, { data: scholData }, { data: reqMap }, { data: studData }, { data: eligDefs }] =
        await Promise.all([
          supabase.from("scholarship_applications").select("*").eq("student_id", sid),
          supabase.from("scholarships").select("*"),
          supabase.from("scholarship_requirements").select("*"),
          supabase.from("student_eligibility_profile").select("*").eq("student_id", sid),
          supabase.from("eligibility_requirements").select("eligibility_requirement_id, requirement_name"),
        ]);

      setApplications(appData    || []);
      setScholarships(scholData  || []);
      setRequirementsMap(reqMap  || []);
      setStudentReq(studData     || []);
      setEligibilityDefs(eligDefs || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadAcademic = async () => {
    const { data } = await supabase.from("academic_settings")
      .select("*").order("updated_at", { ascending: false }).limit(1).single();
    setAcademic(data);
  };

  // ── eligibility ─────────────────────────────────────────
  const getApplication = (id) => applications.find((a) => a.scholarship_id === id);

  const isEligible = (scholarship) => {
    const required = requirementsMap
      .filter((r) => r.scholarship_id === scholarship.scholarship_id && r.eligibility_requirement_id)
      .map((r) => r.eligibility_requirement_id);
    if (!required.length) return true;
    return required.every((reqId) => {
      const match = studentReq.find((r) => r.eligibility_requirement_id === reqId);
      return match?.status === "Compliant";
    });
  };

  const getReasons = (scholarship) => {
    const required = requirementsMap.filter(
      (r) => r.scholarship_id === scholarship.scholarship_id && r.eligibility_requirement_id
    );
    return required.flatMap((r) => {
      const rec = studentReq.find((s) => s.eligibility_requirement_id === r.eligibility_requirement_id);
      const def = eligibilityDefs.find((d) => d.eligibility_requirement_id === r.eligibility_requirement_id);
      const name = def?.requirement_name || "Requirement";
      if (!rec)                      return [`${name} — Not submitted`];
      if (rec.status !== "Compliant") return [`${name} — ${rec.status}`];
      return [];
    });
  };

  // ── apply modal ─────────────────────────────────────────
  const openApply = async (scholarship) => {
    setSelectedScholarship(scholarship);
    setFormMeta(null);
    setFormFields([]);
    setFormAnswers({});
    answersRef.current = {};
    setFormError("");
    setFormLoading(true);
    setShowForm(true);

    const { data: form } = await supabase
      .from("scholarship_application_forms")
      .select("*").eq("scholarship_id", scholarship.scholarship_id).single();

    if (!form) {
      setFormError("No application form has been set up for this scholarship yet.");
      setFormLoading(false);
      return;
    }
    setFormMeta(form);

    const { data: fields } = await supabase
      .from("scholarship_form_fields").select("*").eq("form_id", form.form_id);

    setFormFields(fields || []);
    setFormLoading(false);
  };

  const closeApply = () => {
    setShowForm(false);
    setSelectedScholarship(null);
    setFormMeta(null);
    setFormFields([]);
    setFormAnswers({});
    setFileAnswers({});
    setUploadingFields(new Set());
    answersRef.current = {};
    setFormError("");
  };

  // onChange handler is stable — uses functional updater, not closing
  // over formAnswers, so React never sees a "changed" handler reference
  const handleAnswer = (fieldId, value) => {
    setFormAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  // For file fields — store the File object locally, upload on submit
  const handleFileSelect = (fieldId, file) => {
    if (!file) return;
    setFileAnswers((prev) => ({ ...prev, [fieldId]: file }));
    // Store the filename as a placeholder so validation sees the field is filled
    setFormAnswers((prev) => ({ ...prev, [fieldId]: file.name }));
    answersRef.current = { ...answersRef.current, [fieldId]: file.name };
  };

  const submitApplication = async () => {
    const answers = answersRef.current;
    // Only check required fields
    const missing = formFields.filter(
      (f) => f.is_required && !String(answers[f.field_id] || "").trim()
    );
    if (missing.length) {
      setFormError(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setSubmitting(true);
    setFormError("");

    // 1. Create the application row first to get an application_id
    const { data: app, error: appError } = await supabase
      .from("scholarship_applications")
      .insert({
        student_id:     studentId,
        scholarship_id: selectedScholarship.scholarship_id,
        status:         "Pending",
        academic_year:  academic?.academic_year,
        semester:       academic?.semester,
      }).select().single();

    if (appError) { setFormError(appError.message); setSubmitting(false); return; }

    // 2. Upload any file fields, swap filename placeholder → public URL
    const resolvedAnswers = { ...answers };

    for (const field of formFields) {
      if (field.field_type !== "file") continue;
      const file = fileAnswers[field.field_id];
      if (!file) continue;

      setUploadingFields((prev) => new Set([...prev, field.field_id]));

      const ext      = file.name.split(".").pop();
      const filePath = `${app.application_id}/${field.field_id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("application-documents")
        .upload(filePath, file, { upsert: true });

      setUploadingFields((prev) => {
        const next = new Set(prev); next.delete(field.field_id); return next;
      });

      if (uploadErr) {
        setFormError(`Upload failed for "${field.label}": ${uploadErr.message}`);
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("application-documents")
        .getPublicUrl(filePath);

      resolvedAnswers[field.field_id] = urlData.publicUrl;
    }

    // 3. Insert all responses (text answers + resolved file URLs)
    const responses = Object.entries(resolvedAnswers).map(([fieldId, answer]) => ({
      application_id: app.application_id,
      field_id:       fieldId,
      answer:         String(answer),
    }));

    const { error: resError } = await supabase
      .from("application_form_responses").insert(responses);

    if (resError) { setFormError(resError.message); setSubmitting(false); return; }

    setSubmitting(false);
    closeApply();
    load();
  };

  const eligible    = scholarships.filter(isEligible);
  const notEligible = scholarships.filter((sc) => !isEligible(sc));

  // ── recommendations ──────────────────────────────────────
  // Two things make a scholarship worth suggesting: how much it's
  // actually worth OVER TIME (a ₱5,000/semester award paid until
  // graduation is worth far more than a ₱5,000 one-time award — sticker
  // amount alone was misleading), and how convenient it is to get,
  // measured as how few outstanding requirements stand in the way.
  // Eligibility no longer gates applying at all — it's just a signal to
  // help students sort, since final review happens with the coordinator
  // anyway — so every scholarship not yet applied to is a candidate.
  const getMissingCount = (sc) => getReasons(sc).length;

  const daysUntilDeadline = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return Number.isNaN(diff) ? null : diff;
  };

  // Same duration → semester-slot mapping used on the cashier payout
  // schedule, so "how much this is really worth" lines up with how it
  // actually gets paid out. Two things feed off the student's own
  // year_level:
  //  1. "Until Graduation" has no fixed end, so it's estimated from
  //     remaining semesters instead of a flat guess.
  //  2. Every OTHER duration also gets capped at remaining semesters —
  //     a "4 Academic Years" scholarship is only worth its full nominal
  //     value to an incoming 1st year; a 3rd year applying for the same
  //     award will graduate partway through it and never collect the
  //     later payouts, so counting the full 8 semesters would overstate
  //     what they can actually gain.
  // Assumes a typical 4-year program when year_level is unknown or the
  // program actually runs longer (e.g. Engineering/Architecture) — an
  // approximation, not exact, but far better than ignoring it entirely.
  const remainingSemesters = () => {
    const year = studentProfile?.year_level;
    if (!year) return null; // unknown — don't cap, just use the nominal duration
    return Math.max(1, (4 - year + 1) * 2);
  };

  const DURATION_TO_SEMESTERS = {
    "1 Semester": 1,
    "1 Academic Year": 2,
    "2 Academic Years": 4,
    "3 Academic Years": 6,
    "4 Academic Years": 8,
    "Until Graduation": remainingSemesters() ?? 8,
  };
  const MONTHS_PER_SEMESTER = 5;

  const estimatedPayoutCount = (sc) => {
    const remaining = remainingSemesters();
    const nominal = DURATION_TO_SEMESTERS[sc.duration_type] ?? 1;
    const semesters = remaining ? Math.min(nominal, remaining) : nominal;
    switch (sc.payout_frequency) {
      case "One-time": return 1;
      case "Annual":   return Math.max(1, Math.round(semesters / 2));
      case "Monthly":  return semesters * MONTHS_PER_SEMESTER;
      case "Semester":
      default:         return semesters;
    }
  };

  const totalValue = (sc) => Number(sc.amount || 0) * estimatedPayoutCount(sc);

  const isCappedByGraduation = (sc) => {
    const remaining = remainingSemesters();
    const nominal = DURATION_TO_SEMESTERS[sc.duration_type] ?? 1;
    return remaining !== null && remaining < nominal;
  };

  const candidates = scholarships.filter((sc) => !getApplication(sc.scholarship_id));
  const maxValue = Math.max(1, ...candidates.map(totalValue));

  const scored = candidates.map((sc) => {
    const missing = getMissingCount(sc);
    const amount = Number(sc.amount || 0);
    const valueScore = totalValue(sc) / maxValue;      // 0–1, higher = more total money over time
    const convenienceScore = 1 / (1 + missing);        // 0–1, 1 = already eligible
    return {
      ...sc,
      _missing: missing,
      _amount: amount,
      _totalValue: totalValue(sc),
      _payoutCount: estimatedPayoutCount(sc),
      _cappedByGraduation: isCappedByGraduation(sc),
      _valueScore: valueScore,
      _convenienceScore: convenienceScore,
      _bestScore: valueScore * 0.5 + convenienceScore * 0.5,
    };
  });

  const SORTERS = {
    best:        (a, b) => b._bestScore - a._bestScore,
    amount:      (a, b) => b._totalValue - a._totalValue,
    convenience: (a, b) => a._missing - b._missing || b._totalValue - a._totalValue,
  };

  const recommended = [...scored].sort(SORTERS[sortMode]).slice(0, 3);

  if (loading) return <PageLoader label="Loading your scholarships…" />;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1>Scholarship Dashboard</h1>
        <p className={s.subtitle}>Browse open scholarships and track which ones you qualify for.</p>
      </div>

      {/* stats */}
      <div className={s.statsRow}>
        <div className={s.statCard}>
          <div className={s.statNum}>{scholarships.length}</div>
          <div className={s.statLbl}>Total scholarships</div>
        </div>
        <div className={s.statCard}>
          <div className={`${s.statNum} ${s.statSuccess}`}>{eligible.length}</div>
          <div className={s.statLbl}>Eligible</div>
        </div>
        <div className={s.statCard}>
          <div className={`${s.statNum} ${s.statDanger}`}>{notEligible.length}</div>
          <div className={s.statLbl}>May need more requirements</div>
        </div>
      </div>

      {/* recommendations */}
      {recommended.length > 0 && (
        <section className={s.section}>
          <div className={s.recHeader}>
            <h2 className={s.sectionTitle}><span className={s.dotGold} /> Recommended for you</h2>
            <div className={s.sortToggle} role="group" aria-label="Sort recommendations">
              <button
                className={sortMode === "best" ? s.sortBtnActive : s.sortBtn}
                onClick={() => setSortMode("best")}
              >
                Best match
              </button>
              <button
                className={sortMode === "amount" ? s.sortBtnActive : s.sortBtn}
                onClick={() => setSortMode("amount")}
              >
                Highest amount
              </button>
              <button
                className={sortMode === "convenience" ? s.sortBtnActive : s.sortBtn}
                onClick={() => setSortMode("convenience")}
              >
                Easiest to qualify
              </button>
            </div>
          </div>

          <div className={s.recGrid}>
            {recommended.map((sc) => {
              const days = daysUntilDeadline(sc.submission_deadline);
              const urgent = days !== null && days >= 0 && days <= 14;
              return (
                <div key={sc.scholarship_id} className={s.recCard}>
                  <div className={s.recCardTop}>
                    <div>
                      <span className={s.recAmount}>₱{sc._totalValue.toLocaleString()}</span>
                      {sc._payoutCount > 1 && (
                        <span className={s.recAmountSub}>
                          {" "}(₱{sc._amount.toLocaleString()} × {sc._payoutCount})
                        </span>
                      )}
                    </div>
                    {sc._missing === 0 ? (
                      <span className={s.recBadgeGood}>Eligible now</span>
                    ) : (
                      <span className={s.recBadgeWarn}>
                        {sc._missing} requirement{sc._missing === 1 ? "" : "s"} short
                      </span>
                    )}
                  </div>

                  <h3 className={s.recName}>{sc.scholarship_name}</h3>
                  {sc.description && <p className={s.recDesc}>{sc.description}</p>}

                  <div className={s.recMeta}>
                    <span>{sc.payout_frequency || "—"} payout</span>
                    <span>·</span>
                    <span>
                      {sc.duration_type || "—"}
                      {sc._cappedByGraduation && (
                        <> (~{remainingSemesters()} sem. left before graduation)</>
                      )}
                    </span>
                  </div>

                  <div className={s.recFooter}>
                    <span className={urgent ? s.recDeadlineUrgent : s.recDeadline}>
                      {sc.submission_deadline
                        ? urgent
                          ? `Apply soon — ${days} day${days === 1 ? "" : "s"} left`
                          : `Due ${sc.submission_deadline}`
                        : "No deadline set"}
                    </span>

                    <button className={s.applyBtn} onClick={() => openApply(sc)}>Apply</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* eligible */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}><span className={s.dotSuccess} /> Eligible scholarships</h2>
        {eligible.length === 0 ? (
          <div className={s.emptyCard}>
            <EmptyState icon="🎓" title="No eligible scholarships right now"
              description="Once your compliance profile matches a scholarship's requirements, it'll appear here." />
          </div>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><th>Name</th><th className={uiStyles.colOptional}>Description</th><th>Amount</th><th className={uiStyles.colOptional}>Frequency</th><th className={uiStyles.colOptional}>Duration</th><th>Deadline</th><th>Action</th></tr></thead>
              <tbody>
                {eligible.map((sc) => {
                  const app = getApplication(sc.scholarship_id);
                  return (
                    <tr key={sc.scholarship_id}>
                      <td className={s.nameCell}>{sc.scholarship_name}</td>
                      <td className={`${s.descCell} ${uiStyles.colOptional}`}>{sc.description}</td>
                      <td>₱{Number(sc.amount || 0).toLocaleString()}</td>
                      <td className={uiStyles.colOptional}>{sc.payout_frequency || "—"}</td>
                      <td className={uiStyles.colOptional}>{sc.duration_type || "—"}</td>
                      <td>{sc.submission_deadline || "—"}</td>
                      <td>
                        {app
                          ? <Badge status={app.status} />
                          : <button className={s.applyBtn} onClick={() => openApply(sc)}>Apply</button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {/* may need more requirements — still applyable */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}><span className={s.dotDanger} /> May need more requirements</h2>
        <p className={s.sectionNote}>
          These are based on your profile and may be incomplete or outdated — you can still apply.
          The coordinator does the real eligibility check when reviewing your application.
        </p>
        {notEligible.length === 0 ? (
          <div className={s.emptyCard}>
            <EmptyState icon="✅" title="You're eligible for everything listed"
              description="Nice work keeping your compliance profile up to date." />
          </div>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><th>Name</th><th className={uiStyles.colOptional}>Description</th><th>Amount</th><th className={uiStyles.colOptional}>Frequency</th><th className={uiStyles.colOptional}>Duration</th><th>Deadline</th><th>Action</th></tr></thead>
              <tbody>
                {notEligible.map((sc) => {
                  const app = getApplication(sc.scholarship_id);
                  const reasons = getReasons(sc);
                  return (
                    <tr key={sc.scholarship_id}>
                      <td className={s.nameCell}>
                        {sc.scholarship_name}
                        {reasons.length > 0 && (
                          <ul className={s.reasonList}>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        )}
                      </td>
                      <td className={`${s.descCell} ${uiStyles.colOptional}`}>{sc.description}</td>
                      <td>₱{Number(sc.amount || 0).toLocaleString()}</td>
                      <td className={uiStyles.colOptional}>{sc.payout_frequency || "—"}</td>
                      <td className={uiStyles.colOptional}>{sc.duration_type || "—"}</td>
                      <td>{sc.submission_deadline || "—"}</td>
                      <td>
                        {app
                          ? <Badge status={app.status} />
                          : <button className={s.applyBtn} onClick={() => openApply(sc)}>Apply</button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {/* ── Apply modal ─────────────────────────────────────
          Rendered directly here — NOT via the shared Modal component.
          Keeping state and inputs in the same component means no props
          cross component boundaries on every keystroke, so React never
          re-creates input elements and focus is never lost.          */}
      {showForm && (
        <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && closeApply()}>
          <div className={s.modal} role="dialog" aria-modal="true" aria-label="Apply for scholarship">
            <div className={s.modalHead}>
              <h2 className={s.modalTitle}>{selectedScholarship?.scholarship_name}</h2>
              <button className={s.modalClose} onClick={closeApply} aria-label="Close">✕</button>
            </div>

            <div className={s.modalBody}>
              {formLoading && <PageLoader label="Loading application form…" />}

              {!formLoading && formError && !formMeta && (
                <p className={s.errBlock}>{formError}</p>
              )}

              {!formLoading && formMeta && (
                <>
                  {formMeta.form_title && <p className={s.formSub}>{formMeta.form_title}</p>}
                  {formMeta.terms_and_conditions && <p className={s.terms}>{formMeta.terms_and_conditions}</p>}

                  {academic && (
                    <div className={s.academicBox}>
                      <strong>Academic period</strong>
                      <span>{academic.academic_year} · {academic.semester}</span>
                    </div>
                  )}

                  {formFields.length === 0 ? (
                    <p className={s.errBlock}>No questions configured for this scholarship yet.</p>
                  ) : (
                    <div className={s.fieldList}>
                      {formFields.map((field) => (
                        <div key={field.field_id} className={s.fieldItem}>
                          <label className={s.fieldLabel} htmlFor={`ff-${field.field_id}`}>
                            {field.label}
                            {field.is_required && <span className={s.req}> *</span>}
                          </label>

                          {field.field_type === "file" ? (
                            <div className={s.fileWrap}>
                              <label
                                className={`${s.fileBtn} ${uploadingFields.has(field.field_id) ? s.fileBtnBusy : ""}`}
                                htmlFor={`ff-${field.field_id}`}
                              >
                                {uploadingFields.has(field.field_id)
                                  ? "Uploading…"
                                  : "Choose file"}
                              </label>
                              <input
                                id={`ff-${field.field_id}`}
                                type="file"
                                className={s.hiddenInput}
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                disabled={uploadingFields.has(field.field_id) || submitting}
                                onChange={(e) => handleFileSelect(field.field_id, e.target.files[0])}
                              />
                              {formAnswers[field.field_id] && (
                                <span className={s.fileName}>
                                  {formAnswers[field.field_id]}
                                </span>
                              )}
                              <p className={s.fileHint}>PDF, Word, PNG, or JPG</p>
                            </div>
                          ) : (
                            <input
                              id={`ff-${field.field_id}`}
                              className={s.fieldInput}
                              type={
                                field.field_type === "number" ? "number"
                                : field.field_type === "date" ? "date"
                                : "text"
                              }
                              value={formAnswers[field.field_id] || ""}
                              onChange={(e) => handleAnswer(field.field_id, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {formError && <p className={s.errInline}>{formError}</p>}
                </>
              )}
            </div>

            <div className={s.modalFoot}>
              <button className={s.btnSecondary} onClick={closeApply} disabled={submitting}>Cancel</button>
              <button
                className={s.btnPrimary}
                onClick={submitApplication}
                disabled={submitting || !formMeta || formFields.length === 0}
              >
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
