import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import { Card, Badge, EmptyState } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/context/ToastContext";
import { getCached, setCached } from "@/lib/dataCache";
import styles from "./Concerns.module.css";

const CACHE_KEY = "student-concerns";

const CATEGORIES = ["Application", "Compliance", "Financial", "Technical", "Other"];

// "Open" / "In Progress" don't have a built-in tone in the shared Badge
// component's status map, so they're spelled out explicitly here rather
// than falling back to a generic neutral badge for every status.
const STATUS_TONE = { Open: "warning", "In Progress": "info", Resolved: "success" };

export default function Concerns() {
  const { profile } = useSession();
  const toast = useToast();
  const cached = getCached(CACHE_KEY);
  const [studentId, setStudentId] = useState(null);
  const [concerns, setConcerns] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);

  const [selected, setSelected] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Other");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  const load = async () => {
    if (!getCached(CACHE_KEY)) setLoading(true);

    try {
      const { data: studentRow } = await supabase
        .from("students")
        .select("student_id")
        .eq("user_id", profile.user_id)
        .single();

      if (!studentRow) { setLoading(false); return; }
      setStudentId(studentRow.student_id);

      const { data } = await supabase
        .from("student_concerns")
        .select("*")
        .eq("student_id", studentRow.student_id)
        .order("created_at", { ascending: false });

      setConcerns(data || []);
      setCached(CACHE_KEY, data || []);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load your concerns. Please try refreshing the page.");
    } finally {
      setLoading(false);
    }
  };

  const openForm = () => {
    setSubject(""); setCategory("Other"); setMessage("");
    setShowForm(true);
  };

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both a subject and a description.");
      return;
    }
    if (!studentId) return;

    setSubmitting(true);
    const { error } = await supabase.from("student_concerns").insert({
      student_id: studentId,
      subject: subject.trim(),
      category,
      message: message.trim(),
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }

    setShowForm(false);
    toast.success("Sent to your coordinator.");
    load();
  };

  if (loading) return <PageLoader label="Loading your concerns…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Concerns</h1>
          <p className={styles.subtitle}>
            Send a problem or concern straight to your coordinator and track their reply here.
          </p>
        </div>
        <Button onClick={openForm}>New Concern</Button>
      </div>

      {concerns.length === 0 ? (
        <Card>
          <EmptyState
            icon="💬"
            title="No concerns yet"
            description="Have a problem with your application, compliance, or anything else? Send it to your coordinator and check back here for their reply."
            action={<Button onClick={openForm}>New Concern</Button>}
          />
        </Card>
      ) : (
        <>
          <div className={styles.statsRow}>
            <StatCard
              label="Open"
              value={concerns.filter((c) => c.status === "Open").length}
              tone="warning"
              explain="Concerns you've sent that haven't been responded to yet."
            />
            <StatCard
              label="In Progress"
              value={concerns.filter((c) => c.status === "In Progress").length}
              explain="Concerns your coordinator has replied to but marked as still ongoing."
            />
            <StatCard
              label="Resolved"
              value={concerns.filter((c) => c.status === "Resolved").length}
              tone="success"
              explain='Concerns marked "Resolved".'
            />
            <StatCard
              label="Total"
              value={concerns.length}
              explain="All concerns you've ever sent."
            />
          </div>

          <div className={styles.grid}>
          {concerns.map((c) => (
            <Card key={c.concern_id} className={styles.concernCard} onClick={() => setSelected(c)}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{c.subject}</h3>
                <Badge tone={STATUS_TONE[c.status]} status={c.status} />
              </div>
              <p className={styles.category}>{c.category}</p>
              <p className={styles.preview}>{c.message}</p>
              <p className={styles.date}>Sent {new Date(c.created_at).toLocaleDateString()}</p>
              {c.coordinator_response && (
                <p className={styles.replyPill}>Scholarship Coordinator replied</p>
              )}
            </Card>
          ))}
        </div>
        </>
      )}

      {/* NEW CONCERN MODAL */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Send a concern"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting}>Send to coordinator</Button>
          </>
        }
      >
        <div className={styles.formFields}>
          <Field label="Subject" required>
            {({ id }) => (
              <Input id={id} value={subject} placeholder="Briefly describe the issue…"
                onChange={(e) => setSubject(e.target.value)} />
            )}
          </Field>
          <Field label="Category">
            {({ id }) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Details" required>
            {({ id }) => (
              <Textarea id={id} style={{ height: 140 }} value={message}
                placeholder="Explain what's going on — the more detail, the faster your coordinator can help."
                onChange={(e) => setMessage(e.target.value)} />
            )}
          </Field>
        </div>
      </Modal>

      {/* VIEW / REPLY THREAD MODAL */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject}
        size="md"
      >
        {selected && (
          <div className={styles.thread}>
            <div className={styles.threadMeta}>
              <Badge tone={STATUS_TONE[selected.status]} status={selected.status} />
              <span className={styles.category}>{selected.category}</span>
              <span className={styles.date}>{new Date(selected.created_at).toLocaleString()}</span>
            </div>

            <div className={styles.bubble}>
              <strong className={styles.bubbleLabel}>You</strong>
              <p>{selected.message}</p>
            </div>

            {selected.coordinator_response ? (
              <div className={`${styles.bubble} ${styles.bubbleReply}`}>
                <strong className={styles.bubbleLabel}>Scholarship Coordinator</strong>
                <p>{selected.coordinator_response}</p>
                {selected.responded_at && (
                  <span className={styles.date}>{new Date(selected.responded_at).toLocaleString()}</span>
                )}
              </div>
            ) : (
              <p className={styles.waiting}>Waiting on a reply from your coordinator.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
