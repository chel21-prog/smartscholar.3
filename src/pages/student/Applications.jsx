import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Badge, EmptyState } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import PageLoader from "@/components/ui/PageLoader";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/context/ToastContext";
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
  const requestToken = useRef(0);
  const { askConfirm, confirmDialog } = useConfirm();
  const toast = useToast();

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
      toast.error("Couldn't load your applications. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const viewAnswers = async (app) => {
    const token = ++requestToken.current;
    setSelectedApp(app);
    setAnswers([]);

    const { data } = await supabase
      .from("application_form_responses")
      .select(`response_id, field_id, answer, scholarship_form_fields ( label )`)
      .eq("application_id", app.application_id)
      .order("response_id", { ascending: true });

    if (token !== requestToken.current) return; // a newer click already superseded this one

    // Defensive dedupe: if duplicate rows exist for the same field_id
    // (e.g. from a double-submitted application), keep the latest one.
    const deduped = Object.values(
      (data || []).reduce((acc, r) => {
        acc[r.field_id] = r;
        return acc;
      }, {})
    );

    setAnswers(deduped);
  };

  const cancelApplication = (id) => {
    if (cancellingId) return; // one cancel in flight at a time
    askConfirm(
      "Cancel this application? This can't be undone.",
      () => doCancelApplication(id),
      { variant: "danger", confirmLabel: "Cancel application", cancelLabel: "Keep application" }
    );
  };

  const doCancelApplication = async (id) => {
    setCancellingId(id);

    try {
      const { error } = await supabase
        .from("scholarship_applications")
        .delete()
        .eq("application_id", id);

      if (error) { toast.error(error.message); return; }

      setApplications((prev) => prev.filter((a) => a.application_id !== id));
      toast.success("Application cancelled.");
    } finally {
      setCancellingId(null);
    }
  };

  const editApplication = async (app) => {
    const token = ++requestToken.current;
    setEditApp(app);
    setFormMeta(null);
    setFormFields([]);
    setFormAnswers({});

    const { data: form } = await supabase
      .from("scholarship_application_forms")
      .select("*")
      .eq("scholarship_id", app.scholarship_id)
      .single();

    if (token !== requestToken.current) return;
    setFormMeta(form);
    if (!form) return;

    const { data: fields } = await supabase
      .from("scholarship_form_fields")
      .select("*")
      .eq("form_id", form.form_id)
      .order("field_id", { ascending: true });

    // Defensive dedupe: guards against leftover duplicate rows in
    // scholarship_form_fields (can happen if a scholarship's form was
    // edited before duplicate-safe saving was in place on the
    // coordinator side). Keeps the first (oldest) row per label so the
    // form doesn't render the same question twice.
    const seenLabels = new Set();
    const dedupedFields = (fields || []).filter((f) => {
      const key = (f.label || "").trim().toLowerCase();
      if (!key || seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });

    const { data: responses } = await supabase
      .from("application_form_responses")
      .select("*")
      .eq("application_id", app.application_id)
      .order("response_id", { ascending: true });

    if (token !== requestToken.current) return;

    const mapped = {};
    (responses || []).forEach((r) => {
      mapped[r.field_id] = r.answer;
    });

    setFormFields(dedupedFields);
    setFormAnswers(mapped);
  };

  const saveEdit = () => {
    if (savingEdit) return; // guards against a second tap landing before the button disables
    askConfirm("Save changes to this application?", doSaveEdit);
  };

  const doSaveEdit = async () => {
    setSavingEdit(true);

    try {
      const failures = [];
      for (const [fieldId, answer] of Object.entries(formAnswers)) {
        const { error } = await supabase
          .from("application_form_responses")
          .update({ answer })
          .eq("application_id", editApp.application_id)
          .eq("field_id", fieldId);
        if (error) failures.push(error.message);
      }

      if (failures.length) {
        toast.error(`${failures.length} answer(s) failed to save: ${failures[0]}`);
      } else {
        toast.success("Application updated.");
      }
    } finally {
      setSavingEdit(false);
      setEditApp(null);
      load();
    }
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

      {confirmDialog}
    </div>
  );
}
