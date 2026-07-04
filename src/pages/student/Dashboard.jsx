import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { Card, Badge, EmptyState } from "@/components/ui/Card";
import { TableWrap, Table } from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import PageLoader from "@/components/ui/PageLoader";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const [scholarships, setScholarships] = useState([]);
  const [requirementsMap, setRequirementsMap] = useState([]);
  const [studentReq, setStudentReq] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [formFields, setFormFields] = useState([]);
  const [formAnswers, setFormAnswers] = useState({});
  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMeta, setFormMeta] = useState(null);
  const [academic, setAcademic] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    load();
    loadAcademic();
  }, []);

  const load = async () => {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("user_id")
        .eq("auth_id", user.id)
        .single();

      const { data: studentRow } = await supabase
        .from("students")
        .select("student_id")
        .eq("user_id", userRow.user_id)
        .single();

      const sid = studentRow.student_id;
      setStudentId(sid);

      const { data: appData } = await supabase
        .from("scholarship_applications")
        .select("*")
        .eq("student_id", sid);

      setApplications(appData || []);

      const { data: scholarshipsData } = await supabase
        .from("scholarships")
        .select("*");

      const { data: reqMap } = await supabase
        .from("scholarship_requirements")
        .select("*");

      const { data: studentData } = await supabase
        .from("student_eligibility_profile")
        .select("*")
        .eq("student_id", sid);

      setScholarships(scholarshipsData || []);
      setRequirementsMap(reqMap || []);
      setStudentReq(studentData || []);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  const loadAcademic = async () => {
    const { data } = await supabase
      .from("academic_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    setAcademic(data);
  };

  const getApplication = (scholarshipId) =>
    applications.find((a) => a.scholarship_id === scholarshipId);

  const isEligible = (scholarship) => {
    const required = requirementsMap
      .filter(
        (r) =>
          r.scholarship_id === scholarship.scholarship_id &&
          r.eligibility_requirement_id
      )
      .map((r) => r.eligibility_requirement_id);

    if (!required.length) return true;

    return required.every((reqId) => {
      const match = studentReq.find((r) => r.eligibility_requirement_id === reqId);
      return match?.status === "Compliant";
    });
  };

  const getNotEligibleReasons = (scholarship) => {
    const required = requirementsMap.filter(
      (r) =>
        r.scholarship_id === scholarship.scholarship_id &&
        r.eligibility_requirement_id
    );

    const reasons = [];

    required.forEach((r) => {
      const studentRecord = studentReq.find(
        (s) => s.eligibility_requirement_id === r.eligibility_requirement_id
      );

      const requirementName = r.requirement_name || "Requirement";

      if (!studentRecord) {
        reasons.push(`${requirementName} — Not submitted`);
        return;
      }

      if (studentRecord.status !== "Compliant") {
        reasons.push(`${requirementName} — ${studentRecord.status}`);
      }
    });

    return reasons;
  };

  const openApply = async (scholarship) => {
    setFormError("");
    setSelectedScholarship(scholarship);
    setShowForm(true);
    setFormMeta(null);
    setFormFields([]);
    setFormAnswers({});

    const { data: form } = await supabase
      .from("scholarship_application_forms")
      .select("*")
      .eq("scholarship_id", scholarship.scholarship_id)
      .single();

    if (!form) {
      setFormError("No application form has been set up for this scholarship yet.");
      return;
    }

    setFormMeta(form);

    const { data: fields } = await supabase
      .from("scholarship_form_fields")
      .select("*")
      .eq("form_id", form.form_id);

    setFormFields(fields || []);
  };

  const closeApply = () => {
    setShowForm(false);
    setSelectedScholarship(null);
    setFormMeta(null);
    setFormFields([]);
    setFormAnswers({});
    setFormError("");
  };

  const submitApplication = async () => {
    const missing = formFields.filter((f) => !String(formAnswers[f.field_id] || "").trim());
    if (missing.length > 0) {
      setFormError(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setFormError("");

    const { data: app, error: appError } = await supabase
      .from("scholarship_applications")
      .insert({
        student_id: studentId,
        scholarship_id: selectedScholarship.scholarship_id,
        status: "Pending",
        academic_year: academic?.academic_year,
        semester: academic?.semester,
      })
      .select()
      .single();

    if (appError) {
      setFormError(appError.message);
      setSubmitting(false);
      return;
    }

    const responses = Object.entries(formAnswers).map(([fieldId, answer]) => ({
      application_id: app.application_id,
      field_id: fieldId,
      answer,
    }));

    const { error: resError } = await supabase
      .from("application_form_responses")
      .insert(responses);

    if (resError) {
      setFormError(resError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    closeApply();
    load();
  };

  const eligible = scholarships.filter(isEligible);
  const notEligible = scholarships.filter((s) => !isEligible(s));

  if (loading) return <PageLoader label="Loading your scholarships…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Scholarship Dashboard</h1>
        <p className={styles.subtitle}>
          Browse open scholarships and track which ones you currently qualify for.
        </p>
      </div>

      {/* STATS */}
      <div className={styles.statsRow}>
        <Card className={styles.statCard}>
          <div className={styles.statNumber}>{scholarships.length}</div>
          <div className={styles.statLabel}>Total scholarships</div>
        </Card>

        <Card className={styles.statCard}>
          <div className={`${styles.statNumber} ${styles.statSuccess}`}>
            {eligible.length}
          </div>
          <div className={styles.statLabel}>You're eligible for</div>
        </Card>

        <Card className={styles.statCard}>
          <div className={`${styles.statNumber} ${styles.statDanger}`}>
            {notEligible.length}
          </div>
          <div className={styles.statLabel}>Not eligible yet</div>
        </Card>
      </div>

      {/* ELIGIBLE */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.dotSuccess} /> Eligible scholarships
        </h2>

        {eligible.length === 0 ? (
          <Card>
            <EmptyState
              icon="🎓"
              title="No eligible scholarships right now"
              description="Once a scholarship's requirements match your compliance profile, it'll show up here ready to apply."
            />
          </Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Deadline</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((s) => {
                  const application = getApplication(s.scholarship_id);
                  return (
                    <tr key={s.scholarship_id}>
                      <td className={styles.nameCell}>{s.scholarship_name}</td>
                      <td className={styles.descCell}>{s.description}</td>
                      <td>₱{Number(s.amount || 0).toLocaleString()}</td>
                      <td>{s.submission_deadline || "—"}</td>
                      <td>
                        {application ? (
                          <Badge status={application.status} />
                        ) : (
                          <Button size="sm" onClick={() => openApply(s)}>
                            Apply
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {/* NOT ELIGIBLE */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.dotDanger} /> Not eligible yet
        </h2>

        {notEligible.length === 0 ? (
          <Card>
            <EmptyState
              icon="✅"
              title="You're eligible for everything currently listed"
              description="Nice work keeping your compliance profile up to date."
            />
          </Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Deadline</th>
                  <th>Why not eligible</th>
                </tr>
              </thead>
              <tbody>
                {notEligible.map((s) => {
                  const reasons = getNotEligibleReasons(s);
                  return (
                    <tr key={s.scholarship_id}>
                      <td className={styles.nameCell}>{s.scholarship_name}</td>
                      <td className={styles.descCell}>{s.description}</td>
                      <td>₱{Number(s.amount || 0).toLocaleString()}</td>
                      <td>{s.submission_deadline || "—"}</td>
                      <td>
                        {reasons.length === 0 ? (
                          <Badge tone="success">Eligible</Badge>
                        ) : (
                          <ul className={styles.reasonList}>
                            {reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {/* APPLY MODAL */}
      <Modal
        open={showForm}
        onClose={closeApply}
        title={selectedScholarship?.scholarship_name}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeApply} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submitApplication}
              loading={submitting}
              disabled={!formMeta || formFields.length === 0}
            >
              Submit application
            </Button>
          </>
        }
      >
        {!formMeta && !formError && (
          <PageLoader label="Loading application form…" />
        )}

        {formError && !formMeta && (
          <p className={styles.formErrorBlock}>{formError}</p>
        )}

        {formMeta && (
          <>
            {formMeta.form_title && (
              <p className={styles.formSubtitle}>{formMeta.form_title}</p>
            )}

            {formMeta.terms_and_conditions && (
              <p className={styles.terms}>{formMeta.terms_and_conditions}</p>
            )}

            {academic && (
              <div className={styles.academicBox}>
                <strong>Current academic period</strong>
                <span>
                  {academic.academic_year} · {academic.semester}
                </span>
              </div>
            )}

            {formFields.length === 0 ? (
              <p className={styles.formErrorBlock}>
                This scholarship doesn't have any application questions configured yet.
              </p>
            ) : (
              <div className={styles.formFields}>
                {formFields.map((field) => (
                  <Field key={field.field_id} label={field.label} required>
                    <Input
                      type={field.field_type === "number" ? "number" : "text"}
                      value={formAnswers[field.field_id] || ""}
                      onChange={(e) =>
                        setFormAnswers({
                          ...formAnswers,
                          [field.field_id]: e.target.value,
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            )}

            {formError && <p className={styles.formErrorInline}>{formError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
