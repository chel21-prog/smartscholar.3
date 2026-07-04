import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Badge, EmptyState } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import PageLoader from "@/components/ui/PageLoader";
import styles from "./Applications.module.css";

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editApp, setEditApp] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [formAnswers, setFormAnswers] = useState({});
  const [formMeta, setFormMeta] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    load();
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

      const { data } = await supabase
        .from("scholarship_applications")
        .select(`
          application_id,
          scholarship_id,
          status,
          application_date,
          scholarships ( scholarship_name )
        `)
        .eq("student_id", studentRow.student_id)
        .order("application_date", { ascending: false });

      setApplications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const viewAnswers = async (app) => {
    setSelectedApp(app);
    setAnswers([]);

    const { data } = await supabase
      .from("application_form_responses")
      .select(`answer, scholarship_form_fields ( label )`)
      .eq("application_id", app.application_id);

    setAnswers(data || []);
  };

  const cancelApplication = async (id) => {
    const confirmed = window.confirm("Cancel this application? This can't be undone.");
    if (!confirmed) return;

    setCancellingId(id);

    const { error } = await supabase
      .from("scholarship_applications")
      .delete()
      .eq("application_id", id);

    setCancellingId(null);

    if (error) return alert(error.message);

    setApplications((prev) => prev.filter((a) => a.application_id !== id));
  };

  const editApplication = async (app) => {
    setEditApp(app);
    setFormMeta(null);
    setFormFields([]);
    setFormAnswers({});

    const { data: form } = await supabase
      .from("scholarship_application_forms")
      .select("*")
      .eq("scholarship_id", app.scholarship_id)
      .single();

    setFormMeta(form);
    if (!form) return;

    const { data: fields } = await supabase
      .from("scholarship_form_fields")
      .select("*")
      .eq("form_id", form.form_id);

    setFormFields(fields || []);

    const { data: responses } = await supabase
      .from("application_form_responses")
      .select("*")
      .eq("application_id", app.application_id);

    const mapped = {};
    (responses || []).forEach((r) => {
      mapped[r.field_id] = r.answer;
    });

    setFormAnswers(mapped);
  };

  const saveEdit = async () => {
    setSavingEdit(true);

    for (const [fieldId, answer] of Object.entries(formAnswers)) {
      await supabase
        .from("application_form_responses")
        .update({ answer })
        .eq("application_id", editApp.application_id)
        .eq("field_id", fieldId);
    }

    setSavingEdit(false);
    setEditApp(null);
    load();
  };

  if (loading) return <PageLoader label="Loading your applications…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>My Applications</h1>
        <p className={styles.subtitle}>
          Track the status of every scholarship you've applied to.
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon="📄"
            title="No applications yet"
            description="Once you apply for a scholarship from the Dashboard, it'll show up here so you can track its status."
          />
        </Card>
      ) : (
        <div className={styles.grid}>
          {applications.map((a) => (
            <Card key={a.application_id} className={styles.appCard}>
              <h3 className={styles.cardTitle}>
                {a.scholarships?.scholarship_name || "Untitled scholarship"}
              </h3>

              <p className={styles.date}>
                Applied {a.application_date || "—"}
              </p>

              <Badge status={a.status} />

              <div className={styles.actions}>
                <Button size="sm" variant="secondary" onClick={() => viewAnswers(a)}>
                  View
                </Button>

                {a.status === "Pending" && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => editApplication(a)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={cancellingId === a.application_id}
                      onClick={() => cancelApplication(a.application_id)}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* VIEW ANSWERS MODAL */}
      <Modal
        open={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="Application answers"
        size="md"
      >
        {answers.length === 0 ? (
          <p className={styles.noAnswers}>No saved answers found for this application.</p>
        ) : (
          answers.map((r, i) => (
            <div key={i} className={styles.answerBox}>
              <strong>{r.scholarship_form_fields?.label}</strong>
              <p>{r.answer}</p>
            </div>
          ))
        )}
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        open={!!editApp}
        onClose={() => setEditApp(null)}
        title="Edit application"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditApp(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={savingEdit} disabled={!formMeta}>
              Save changes
            </Button>
          </>
        }
      >
        {!formMeta ? (
          <PageLoader label="Loading application…" />
        ) : (
          <>
            {formMeta.form_title && (
              <p className={styles.editSubtitle}>{formMeta.form_title}</p>
            )}

            <div className={styles.formFields}>
              {formFields.map((field) => (
                <Field key={field.field_id} label={field.label}>
                  <Input
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
          </>
        )}
      </Modal>
    </div>
  );
}
