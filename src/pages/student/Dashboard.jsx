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
  const [studentReq,     setStudentReq]     = useState([]);
  const [studentId,      setStudentId]      = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [applications,   setApplications]   = useState([]);
  const [academic,       setAcademic]       = useState(null);

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
        .from("students").select("student_id").eq("user_id", userRow.user_id).single();

      const sid = studentRow.student_id;
      setStudentId(sid);

      const [{ data: appData }, { data: scholData }, { data: reqMap }, { data: studData }] =
        await Promise.all([
          supabase.from("scholarship_applications").select("*").eq("student_id", sid),
          supabase.from("scholarships").select("*"),
          supabase.from("scholarship_requirements").select("*"),
          supabase.from("student_eligibility_profile").select("*").eq("student_id", sid),
        ]);

      setApplications(appData    || []);
      setScholarships(scholData  || []);
      setRequirementsMap(reqMap  || []);
      setStudentReq(studData     || []);
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
      const name = r.requirement_name || "Requirement";
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
          <div className={s.statLbl}>Not eligible yet</div>
        </div>
      </div>

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
              <thead><tr><th>Name</th><th className={uiStyles.colOptional}>Description</th><th>Amount</th><th>Deadline</th><th>Action</th></tr></thead>
              <tbody>
                {eligible.map((sc) => {
                  const app = getApplication(sc.scholarship_id);
                  return (
                    <tr key={sc.scholarship_id}>
                      <td className={s.nameCell}>{sc.scholarship_name}</td>
                      <td className={`${s.descCell} ${uiStyles.colOptional}`}>{sc.description}</td>
                      <td>₱{Number(sc.amount || 0).toLocaleString()}</td>
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

      {/* not eligible */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}><span className={s.dotDanger} /> Not eligible yet</h2>
        {notEligible.length === 0 ? (
          <div className={s.emptyCard}>
            <EmptyState icon="✅" title="You're eligible for everything listed"
              description="Nice work keeping your compliance profile up to date." />
          </div>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><th>Name</th><th className={uiStyles.colOptional}>Description</th><th>Amount</th><th>Deadline</th><th>Why not eligible</th></tr></thead>
              <tbody>
                {notEligible.map((sc) => {
                  const reasons = getReasons(sc);
                  return (
                    <tr key={sc.scholarship_id}>
                      <td className={s.nameCell}>{sc.scholarship_name}</td>
                      <td className={`${s.descCell} ${uiStyles.colOptional}`}>{sc.description}</td>
                      <td>₱{Number(sc.amount || 0).toLocaleString()}</td>
                      <td>{sc.submission_deadline || "—"}</td>
                      <td>
                        {reasons.length === 0
                          ? <Badge tone="success">Eligible</Badge>
                          : <ul className={s.reasonList}>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
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
