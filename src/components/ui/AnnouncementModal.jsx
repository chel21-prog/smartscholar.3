import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/hooks/useConfirm";
import { buildSchedule, isEligible } from "@/lib/payoutSchedule";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/Card";
import styles from "./AnnouncementModal.module.css";

// ── Target definitions ────────────────────────────────────────────────────
// Each target has a label, description, and a resolver function that
// returns [{ user_id, first_name, scholarship_name, sponsor,
// submission_deadline, amount, period_label }] using the actual DB state.
// Every field besides user_id is optional per-recipient context — it's
// what lets {{name}}, {{scholarship}}, {{sponsor}}, {{deadline}},
// {{amount}}, and {{period}} auto-fill for each person individually, using
// THEIR OWN scholarship's details, instead of the coordinator having to
// pick one scholarship or type anything in by hand — even though the
// announcement goes out to many people (on possibly different
// scholarships) at once.
const TARGETS = {
  all_students: {
    label: "All Students",
    desc:  "Every registered student, regardless of scholarship",
    resolve: async () => {
      const { data } = await supabase.from("users").select("user_id, first_name").eq("role", "Student");
      return data || [];
    },
  },
  all_grantees: {
    label: "All Active Grantees",
    desc:  "Every student currently on an active scholarship grant",
    resolve: async () => {
      const { data } = await supabase
        .from("grantees")
        .select("students(user_id, users(first_name)), scholarships(scholarship_name, sponsor, submission_deadline, amount)")
        .eq("status", "Active");
      return dedupeRecipients((data || []).map(g => ({
        user_id:             g.students?.user_id,
        first_name:          g.students?.users?.first_name,
        scholarship_name:    g.scholarships?.scholarship_name,
        sponsor:             g.scholarships?.sponsor,
        submission_deadline: g.scholarships?.submission_deadline,
        amount:              g.scholarships?.amount,
      })));
    },
  },
  pending_compliance: {
    label: "Missing Requirements",
    desc:  "Grantees who haven't uploaded at least one required document yet",
    // NOTE: this used to query the `compliance_records` table. That table
    // is real (it's in the schema), but nothing anywhere in the app ever
    // inserts or updates a row in it — student/Compliance.jsx computes
    // compliance live instead, from scholarship_requirements vs
    // application_documents. So compliance_records stays permanently
    // empty and the old query silently returned zero recipients every
    // time. Rebuilt to compute it the same way Compliance.jsx does: for
    // each grantee, is there a required document with no matching
    // application_documents row (with a file_url) for their application?
    resolve: async () => {
      const { data: grantees } = await supabase
        .from("grantees")
        .select("grantee_id, application_id, scholarship_id, students(user_id, users(first_name)), scholarships(scholarship_name, sponsor, submission_deadline, amount)");
      if (!grantees || grantees.length === 0) return [];

      const scholarshipIds = [...new Set(grantees.map(g => g.scholarship_id).filter(Boolean))];
      const applicationIds = [...new Set(grantees.map(g => g.application_id).filter(Boolean))];

      const { data: reqLinks } = await supabase
        .from("scholarship_requirements")
        .select("scholarship_id, application_requirements(requirement_name)")
        .in("scholarship_id", scholarshipIds);
      const requiredByScholarship = {};
      (reqLinks || []).forEach(r => {
        const name = r.application_requirements?.requirement_name;
        if (!name) return;
        (requiredByScholarship[r.scholarship_id] ||= new Set()).add(name);
      });

      const { data: docs } = await supabase
        .from("application_documents")
        .select("application_id, requirement_name, file_url")
        .in("application_id", applicationIds);
      const uploadedByApplication = {};
      (docs || []).forEach(d => {
        if (!d.file_url) return;
        (uploadedByApplication[d.application_id] ||= new Set()).add(d.requirement_name);
      });

      const missing = grantees.filter(g => {
        const required = requiredByScholarship[g.scholarship_id];
        if (!required || required.size === 0) return false;
        const uploaded = uploadedByApplication[g.application_id] || new Set();
        return [...required].some(name => !uploaded.has(name));
      });

      return dedupeRecipients(missing.map(g => ({
        user_id:             g.students?.user_id,
        first_name:          g.students?.users?.first_name,
        scholarship_name:    g.scholarships?.scholarship_name,
        sponsor:             g.scholarships?.sponsor,
        submission_deadline: g.scholarships?.submission_deadline,
        amount:              g.scholarships?.amount,
      })));
    },
  },
  pending_releases: {
    label: "Awaiting Fund Release",
    desc:  "Active, verified grantees whose next payout is due but not yet released",
    // NOTE: this used to filter fund_releases by status = "Pending", but
    // fund_releases rows are only ever inserted as "Released" or "Skipped"
    // (see cashier/Funds.jsx) — an upcoming payout that hasn't happened
    // yet has no row at all. "Pending" never matched anything, so this
    // also silently returned zero recipients. Rebuilt to reuse the same
    // buildSchedule() logic the cashier's own Funds page uses to work out
    // whose next period is "Due", and to get a human-readable label for
    // that period (e.g. "2025-2026 · 1st Semester") for {{period}} —
    // there's no scheduled release *date* to auto-fill here since the
    // release hasn't happened yet, only the period it's for.
    resolve: async () => {
      const { data: grantees } = await supabase
        .from("grantees")
        .select(`
          grantee_id, status, verification_result, academic_year, semester,
          date_awarded, duration_extension_semesters, scholarship_id,
          students(user_id, users(first_name)),
          scholarships(scholarship_name, sponsor, submission_deadline, amount, payout_frequency, duration_type),
          fund_releases(status, release_date, academic_year, semester, payout_period)
        `)
        .eq("status", "Active");

      const due = [];
      (grantees || []).forEach(g => {
        if (!isEligible(g)) return;
        const schedule = buildSchedule(g, g.scholarships || {});
        const duePeriod = schedule.find(p => p.status === "Due");
        if (duePeriod) due.push({ g, duePeriod });
      });

      return dedupeRecipients(due.map(({ g, duePeriod }) => ({
        user_id:          g.students?.user_id,
        first_name:       g.students?.users?.first_name,
        scholarship_name: g.scholarships?.scholarship_name,
        sponsor:          g.scholarships?.sponsor,
        amount:           g.scholarships?.amount,
        period_label:     duePeriod.label,
      })));
    },
  },
  pending_applications: {
    label: "Pending Applicants",
    desc:  "Students who have submitted an application currently under review",
    resolve: async () => {
      const { data } = await supabase
        .from("scholarship_applications")
        .select("students(user_id, users(first_name)), scholarships(scholarship_name, sponsor, submission_deadline, amount)")
        .eq("status", "Pending");
      return dedupeRecipients((data || []).map(r => ({
        user_id:             r.students?.user_id,
        first_name:          r.students?.users?.first_name,
        scholarship_name:    r.scholarships?.scholarship_name,
        sponsor:             r.scholarships?.sponsor,
        submission_deadline: r.scholarships?.submission_deadline,
        amount:              r.scholarships?.amount,
      })));
    },
  },
};

// De-dupes by user_id (a student can show up more than once — e.g. two
// pending applications) while keeping the attached context.
function dedupeRecipients(list) {
  const seen = new Map();
  for (const r of list) {
    if (r.user_id && !seen.has(r.user_id)) seen.set(r.user_id, r);
  }
  return [...seen.values()];
}

function formatDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  if (isNaN(parsed)) return null;
  return parsed.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function formatPeso(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return null;
  return "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Swaps {{name}}, {{scholarship}}, {{sponsor}}, {{deadline}}, {{amount}},
// and {{period}} for each recipient's own data (or a graceful generic
// fallback when that recipient has no such context) so every copy reads
// like it was written to them personally — not just the greeting, but
// every scholarship-specific detail too.
function personalize(text, r) {
  return (text || "")
    .replaceAll("{{name}}",       r?.first_name?.trim() || "Scholar")
    .replaceAll("{{scholarship}}", r?.scholarship_name?.trim() || "your scholarship program")
    .replaceAll("{{sponsor}}",     r?.sponsor?.trim() || "the scholarship provider")
    .replaceAll("{{deadline}}",    formatDate(r?.submission_deadline) || "the scheduled date")
    .replaceAll("{{amount}}",      formatPeso(r?.amount) || "the specified amount")
    .replaceAll("{{period}}",      r?.period_label?.trim() || "the upcoming payout period");
}

// ── Type definitions — determines which targets are available ─────────────
const TYPE_DEFS = {
  General: {
    desc:          "General information for a broad audience",
    targets:       ["all_students", "all_grantees"],
    defaultTarget: "all_students",
    defaultTitle:  "General Announcement",
    defaultBody:   "Dear {{name}},\n\nWe would like to inform you that [details here].\n\nThank you.",
  },
  Reminder: {
    desc:          "Deadline or schedule reminders",
    // "All Students" has no scholarship tied to it (most students aren't
    // on any grant), so {{scholarship}}/{{deadline}} would have nothing
    // real to pull and always fell back to generic text. Defaulting to
    // "All Active Grantees" instead means every recipient actually has a
    // scholarship on file, so the deadline shown is always that specific
    // person's real submission_deadline from the database.
    targets:       ["all_grantees", "all_students"],
    defaultTarget: "all_grantees",
    defaultTitle:  "Reminder: Scholarship Deadline",
    defaultBody:   "Dear {{name}},\n\nThis is a reminder that the deadline for {{scholarship}} submission is on {{deadline}}.\n\nPlease submit your requirements before the deadline to avoid disqualification.\n\nThank you.",
  },
  Compliance: {
    desc:          "Document submission notices — target all grantees or only those with missing documents",
    targets:       ["all_grantees", "pending_compliance"],
    defaultTarget: "pending_compliance",
    defaultTitle:  "Compliance Requirement Notice",
    defaultBody:   "Dear {{name}},\n\nPlease be advised that you have pending compliance requirements for your {{scholarship}} grant.\n\nKindly submit the required documents at the Scholarship Office on or before {{deadline}}.\n\nFailure to comply may result in suspension of your scholarship benefits.\n\nThank you.",
  },
  Approval: {
    desc:          "Application status notifications",
    targets:       ["all_students", "pending_applications"],
    defaultTarget: "pending_applications",
    defaultTitle:  "Scholarship Application Update",
    defaultBody:   "Dear {{name}},\n\nWe would like to inform you of an update regarding your {{scholarship}} application, sponsored by {{sponsor}}.\n\nPlease visit the Scholarship Office for further instructions.\n\nThank you.",
  },
  Finance: {
    desc:          "Fund release schedules — target all grantees or only those awaiting release",
    targets:       ["all_grantees", "pending_releases"],
    defaultTarget: "pending_releases",
    defaultTitle:  "Scholarship Fund Release Notice",
    // Uses {{period}} rather than {{deadline}} here on purpose — a fund
    // release doesn't have a scheduled date until it's actually released,
    // only the payout period it covers (e.g. "2025-2026 · 1st Semester"),
    // so {{deadline}} would have silently shown the application's
    // submission deadline instead, which isn't what this notice is about.
    defaultBody:   "Dear {{name}},\n\nPlease be informed that your {{scholarship}} funds ({{amount}}) for {{period}} are ready for release.\n\nBring a valid school ID and a copy of this notice when claiming.\n\nThank you.",
  },
  Other: {
    desc:          "Custom announcements",
    targets:       ["all_students", "all_grantees"],
    defaultTarget: "all_students",
    defaultTitle:  "",
    defaultBody:   "",
  },
};

const TYPES = Object.keys(TYPE_DEFS);

// ── Seed templates ────────────────────────────────────────────────────────
const SEED_TEMPLATES = TYPES.filter(t => t !== "Other").map(t => ({
  name:   t,
  layout: {
    title:  TYPE_DEFS[t].defaultTitle,
    body:   TYPE_DEFS[t].defaultBody,
    type:   t,
    target: TYPE_DEFS[t].defaultTarget,
  },
}));

const TOKENS = [
  ["{{name}}",        "Recipient's first name"],
  ["{{scholarship}}", "Scholarship name"],
  ["{{sponsor}}",     "Scholarship sponsor"],
  ["{{deadline}}",    "Submission deadline"],
  ["{{amount}}",      "Per-payout amount"],
  ["{{period}}",      "Payout period (fund releases)"],
];

// Every token above except {{name}} needs a real scholarship attached to
// the recipient to resolve to anything but generic fallback text — used to
// warn when the chosen audience (e.g. "All Students") can't supply that.
const SCHOLARSHIP_TOKEN_RE = /\{\{(scholarship|sponsor|deadline|amount|period)\}\}/;

const SMART_TARGETS = ["pending_compliance", "pending_releases", "pending_applications"];

export default function AnnouncementModal({ open, onClose }) {
  const { askConfirm, confirmDialog } = useConfirm();
  const [step,        setStep]        = useState("list");
  const [templates,   setTemplates]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [sentCount,   setSentCount]   = useState(0);
  const [resetting,   setResetting]   = useState(false);

  // compose fields
  const [title,       setTitle]       = useState("");
  const [body,        setBody]        = useState("");
  const [type,        setType]        = useState("General");
  const [target,      setTarget]      = useState("all_students");

  // live recipient list for the current target — powers both the
  // count and the "preview as" cycler, so the coordinator can actually see
  // who's about to get the message (and how it personalizes for them)
  // before hitting send, not after.
  const [previewRecipients, setPreviewRecipients] = useState([]);
  const [previewIndex,      setPreviewIndex]      = useState(0);
  const [previewLoading,    setPreviewLoading]    = useState(false);

  // type-swap confirmation
  const [pendingType, setPendingType] = useState(null);

  // template save
  const [savingTpl,   setSavingTpl]   = useState(false);
  const [tplName,     setTplName]     = useState("");
  const [showSave,    setShowSave]    = useState(false);

  // error
  const [error,       setError]       = useState("");

  useEffect(() => {
    if (open) { loadTemplates(); resetCompose(); setStep("list"); }
  }, [open]);

  // Recomputes the live recipient list whenever the audience changes.
  useEffect(() => {
    if (step !== "compose") return;
    let cancelled = false;
    setPreviewLoading(true);
    resolveRecipients()
      .then(list => { if (!cancelled) { setPreviewRecipients(list); setPreviewIndex(0); } })
      .catch(() => { if (!cancelled) setPreviewRecipients([]); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, target, type]);

  const resetCompose = () => {
    setSent(false); setError(""); setPendingType(null);
    setShowSave(false); setTplName(""); setPreviewRecipients([]); setPreviewIndex(0);
  };

  // Resolves the actual recipient list for the currently selected target —
  // shared by the live preview and the real send, so they can never drift.
  // Every recipient already carries their OWN scholarship's name, sponsor,
  // deadline, and amount straight from the target's resolver — that's what
  // {{scholarship}}/{{sponsor}}/{{deadline}}/{{amount}}/{{period}} pull
  // from, fully automatically, per person.
  const resolveRecipients = async () => {
    const resolver = TARGETS[target]?.resolve;
    if (!resolver) return [];
    return resolver();
  };

  // Templates saved before {{scholarship}}/{{deadline}}/{{sponsor}}/
  // {{period}} existed still carry the old literal "[scholarship name]" /
  // "[date]" bracket text in their body — that text was never meant to be
  // sent as-is, but nothing ever goes back and updates an already-saved
  // template when the code's defaults change. Detect that leftover
  // bracket text and quietly swap those specific templates back to the
  // current type default, so they start auto-filling instead of showing
  // placeholder text forever.
  const LEGACY_PLACEHOLDER_RE = /\[(scholarship name|date|academic year|semester|location)\]/i;

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("report_templates").select("*").order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      const { data: seeded } = await supabase
        .from("report_templates")
        .insert(SEED_TEMPLATES.map(t => ({ name: t.name, layout: t.layout })))
        .select();
      setTemplates(seeded || []);
      setLoading(false);
      return;
    }

    const stale = data.filter(t => LEGACY_PLACEHOLDER_RE.test(t.layout?.body || ""));
    if (stale.length === 0) {
      setTemplates(data);
      setLoading(false);
      return;
    }

    const healed = await Promise.all(stale.map(async t => {
      const def = TYPE_DEFS[t.layout?.type] || TYPE_DEFS.General;
      const layout = { ...t.layout, title: def.defaultTitle, body: def.defaultBody };
      const { data: updated } = await supabase
        .from("report_templates").update({ layout }).eq("template_id", t.template_id).select().single();
      return updated || { ...t, layout };
    }));
    const healedById = new Map(healed.map(h => [h.template_id, h]));
    setTemplates(data.map(t => healedById.get(t.template_id) || t));
    setLoading(false);
  };

  const useTemplate = (tpl) => {
    const t = tpl.layout?.type || "General";
    const def = TYPE_DEFS[t] || TYPE_DEFS.General;
    const savedTarget = tpl.layout?.target;
    // use the saved target only if it's still valid for this type
    const resolvedTarget = def.targets.includes(savedTarget)
      ? savedTarget
      : def.defaultTarget;
    setTitle(tpl.layout?.title || "");
    setBody(tpl.layout?.body   || "");
    setType(t);
    setTarget(resolvedTarget);
    resetCompose();
    setStep("compose");
  };

  const composeBlank = () => {
    setTitle(""); setBody(""); setType("General"); setTarget("all_students");
    resetCompose();
    setStep("compose");
  };

  // When user taps a type chip in compose
  const handleTypeChange = (newType) => {
    // Note: the target itself gets reset inside applyType/keepContent below
    // (whichever the user picks), not here — it depends on whether they
    // keep their customized message or accept the new type's defaults.
    const oldDefault = TYPE_DEFS[type]?.defaultBody?.trim() || "";
    if (body.trim() && body.trim() !== oldDefault) {
      setPendingType(newType);
    } else {
      applyType(newType);
    }
  };

  const applyType = (newType) => {
    const def = TYPE_DEFS[newType];
    setType(newType);
    setTitle(def.defaultTitle);
    setBody(def.defaultBody);
    setTarget(def.defaultTarget);
    setPendingType(null);
  };

  const keepContent = (newType) => {
    setType(newType);
    const def = TYPE_DEFS[newType];
    if (!def.targets.includes(target)) setTarget(def.defaultTarget);
    setPendingType(null);
  };

  const saveAsTemplate = async () => {
    if (!tplName.trim()) return;
    setSavingTpl(true);
    const { data } = await supabase
      .from("report_templates")
      .insert({ name: tplName, layout: { title, body, type, target } })
      .select().single();
    if (data) setTemplates(prev => [...prev, data]);
    setSavingTpl(false); setTplName(""); setShowSave(false);
  };

  const deleteTemplate = (id) => {
    askConfirm("Delete this template?", async () => {
      await supabase.from("report_templates").delete().eq("template_id", id);
      setTemplates(prev => prev.filter(t => t.template_id !== id));
    }, { variant: "danger", confirmLabel: "Delete" });
  };

  // Self-heals the "undefined General" style names some templates ended
  // up with under a previous version of this component's icon handling —
  // wipes whatever's saved and reseeds cleanly from the (now-fixed) defaults.
  const resetToDefaults = () => {
    askConfirm(
      "Delete all saved templates and reseed the default ones? Any custom templates you've made will be lost.",
      async () => {
        setResetting(true);
        await supabase.from("report_templates").delete().neq("template_id", 0);
        const { data: seeded } = await supabase
          .from("report_templates")
          .insert(SEED_TEMPLATES.map(t => ({ name: t.name, layout: t.layout })))
          .select();
        setTemplates(seeded || []);
        setResetting(false);
      },
      { confirmLabel: "Reset templates" }
    );
  };

  const send = async () => {
    setError("");
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    setSending(true);
    try {
      const recipients = await resolveRecipients();

      if (recipients.length === 0) {
        setError(`No recipients found for "${TARGETS[target]?.label}". Nobody matching this filter exists in the database right now.`);
        setSending(false);
        return;
      }

      // Each row gets its own copy of the title/message with {{name}},
      // {{scholarship}}, {{deadline}}, and {{amount}} swapped for that
      // recipient's own data — so hundreds of people getting the same
      // announcement each see something addressed to them, not a visible
      // mail-merge blast.
      const { error: insertError } = await supabase.from("notifications").insert(
        recipients.map(r => ({
          user_id:           r.user_id,
          title:              personalize(title, r),
          message:            personalize(body, r),
          notification_type: type,
          is_read:           false,
        }))
      );
      if (insertError) throw insertError;

      setSentCount(recipients.length);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  if (!open) return null;

  const typeDef       = TYPE_DEFS[type] || TYPE_DEFS.General;
  const validTargets   = typeDef.targets;
  const targetDef      = TARGETS[target];
  const activeRecipient = previewRecipients[previewIndex] || null;
  const previewCount    = previewRecipients.length;
  const usesScholarshipTokens = SCHOLARSHIP_TOKEN_RE.test(title) || SCHOLARSHIP_TOKEN_RE.test(body);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={step === "compose" ? "xl" : "md"}
      title={step === "list" ? "Announcements" : "Compose Announcement"}
      footer={
        step === "compose" && !sent ? (
          <>
            <Button variant="ghost" onClick={() => { resetCompose(); setStep("list"); }} disabled={sending} style={{marginRight:"auto"}}>
              Back
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button
              variant="primary"
              onClick={send}
              loading={sending}
              disabled={previewLoading || previewCount === 0}
              title={previewCount === 0 ? "Nobody currently matches this filter — nothing to send." : undefined}
            >
              {previewLoading
                ? "Checking audience…"
                : `Send to ${previewCount} recipient${previewCount !== 1 ? "s" : ""}`}
            </Button>
          </>
        ) : null
      }
    >
      {/* ── STEP 1: template gallery ── */}
      {step === "list" && (
        <div className={styles.controls}>
          <button className={styles.blankCard} onClick={composeBlank}>
            Start from scratch
          </button>

          <div className={styles.sectionRow}>
            <p className={styles.sectionLabel}>Saved templates</p>
            <button className={styles.linkBtn} onClick={resetToDefaults} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset to defaults"}
            </button>
          </div>

          {loading ? (
            <p className={styles.typeHint}>Loading templates…</p>
          ) : templates.length === 0 ? (
            <EmptyState title="No templates yet" description="Start from scratch and save it as a template to see it here." />
          ) : (
            <div className={styles.tplGrid}>
              {templates.map(t => {
                const tgt = TARGETS[t.layout?.target];
                return (
                  <button key={t.template_id} className={styles.tplCard} onClick={() => useTemplate(t)}>
                    <div className={styles.tplCardTop}>
                      <span className={styles.tplTypeChip}>{t.layout?.type || "General"}</span>
                      <span
                        className={styles.tplDelete}
                        role="button"
                        tabIndex={0}
                        aria-label="Delete template"
                        onClick={(e) => { e.stopPropagation(); deleteTemplate(t.template_id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); deleteTemplate(t.template_id); } }}
                      >✕</span>
                    </div>
                    <div className={styles.tplName}>{t.name}</div>
                    {tgt && <div className={styles.tplAudience}>{tgt.label}</div>}
                    <p className={styles.tplPreview}>{(t.layout?.body || "").slice(0, 90)}…</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: compose ── */}
      {step === "compose" && (
        sent ? (
          <div className={styles.sentBox}>
            <div className={styles.sentIcon}>✓</div>
            <h3 style={{margin:"0 0 6px",color:"var(--success-700)"}}>Announcement sent!</h3>
            <p style={{margin:"0 0 4px",fontSize:15,fontWeight:700,color:"var(--text-primary)"}}>
              {sentCount} recipient{sentCount !== 1 ? "s" : ""} notified
            </p>
            <p style={{margin:0,fontSize:13,color:"var(--text-secondary)"}}>
              {TARGETS[target]?.label}
            </p>
            <Button variant="primary" style={{marginTop:18}} onClick={() => { resetCompose(); setStep("list"); }}>
              Back to templates
            </Button>
          </div>
        ) : (
          <div className={styles.workspace}>

            {/* ── left: controls ── */}
            <div className={styles.controls}>

              <Field label="Announcement type">
                <div className={styles.chipGroup}>
                  {TYPES.map(t => (
                    <button key={t} type="button"
                      className={[styles.chip, type === t ? styles.chipActive : ""].join(" ")}
                      onClick={() => handleTypeChange(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <p className={styles.typeHint}>{typeDef.desc}</p>
              </Field>

              {pendingType && (
                <div className={styles.swapBanner}>
                  <p>Switch to the <strong>{pendingType}</strong> default message, or keep what you've written?</p>
                  <div className={styles.swapActions}>
                    <Button size="sm" variant="primary" onClick={() => applyType(pendingType)}>
                      Use {pendingType} template
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => keepContent(pendingType)}>Keep my message</Button>
                  </div>
                </div>
              )}

              <Field label="Send to">
                <div className={styles.chipGroup}>
                  {validTargets.map(v => {
                    const td = TARGETS[v];
                    const isSmart = SMART_TARGETS.includes(v);
                    const active = target === v;
                    return (
                      <button key={v} type="button"
                        className={[styles.chip, active ? (isSmart ? styles.chipSmartActive : styles.chipActive) : ""].join(" ")}
                        onClick={() => setTarget(v)}>
                        {td?.label}
                        {isSmart && <span className={styles.chipSmartMark}>SMART</span>}
                      </button>
                    );
                  })}
                </div>
                {targetDef && <p className={styles.typeHint}>{targetDef.desc}</p>}
              </Field>

              {target === "all_students" && usesScholarshipTokens && (
                <div className={styles.swapBanner}>
                  <p>{"\u201cAll Students\u201d isn\u2019t tied to any one scholarship, so {{scholarship}}, {{sponsor}}, {{deadline}}, {{amount}}, and {{period}} won\u2019t have real data to pull for most of them and will fall back to generic text. Switch to \u201cAll Active Grantees\u201d (or another scholarship-linked audience) so each recipient's actual details fill in."}</p>
                </div>
              )}

              <Field label="Subject / title">
                {({ id }) => (
                  <Input id={id} value={title} placeholder="Announcement subject…" onChange={e => setTitle(e.target.value)} />
                )}
              </Field>

              <Field label="Message">
                {({ id }) => (
                  <>
                    <div className={styles.tokenRow}>
                      {TOKENS.map(([token, hint]) => (
                        <button key={token} type="button" className={styles.tokenBtn}
                          onClick={() => setBody(b => b + token)} title={`Insert — ${hint}`}>
                          + {token}
                        </button>
                      ))}
                    </div>
                    <Textarea id={id} style={{height:170}} value={body} placeholder="Type your announcement here…"
                      onChange={e => setBody(e.target.value)} />
                  </>
                )}
              </Field>

              {error && <div className={styles.errorBox}>{error}</div>}

              <div className={styles.saveRow}>
                {showSave ? (
                  <>
                    <Input style={{flex:1,height:36}} placeholder="Template name…" value={tplName} onChange={e => setTplName(e.target.value)} />
                    <Button size="sm" variant="primary" loading={savingTpl} onClick={saveAsTemplate}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSave(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setShowSave(true)}>Save as template</Button>
                )}
              </div>
            </div>

            {/* ── right: live preview ── */}
            <div className={styles.previewPane}>
              <div className={styles.previewHead}>
                <p className={styles.previewLabel}><span className={styles.pulseDot} />Live preview</p>
                <span className={[styles.countPill, previewCount === 0 && !previewLoading ? styles.countPillZero : ""].join(" ")}>
                  {previewLoading ? "Counting…" : `${previewCount} recipient${previewCount !== 1 ? "s" : ""}`}
                </span>
              </div>

              <div className={styles.notifCard}>
                <div className={styles.notifCardHead}>
                  <span>{activeRecipient ? "Preview — as seen by a recipient" : "Notification preview"}</span>
                </div>
                <div className={styles.notifBody}>
                  {activeRecipient ? (
                    <>
                      <strong className={styles.notifTitle}>{personalize(title, activeRecipient) || "(no title yet)"}</strong>
                      <p className={styles.notifMessage}>{personalize(body, activeRecipient) || "(no message yet)"}</p>
                    </>
                  ) : (
                    <p className={styles.notifEmpty}>
                      {previewLoading ? "Finding recipients…" : "Nobody matches this audience yet — adjust the filters above."}
                    </p>
                  )}
                </div>
                {previewCount > 1 && (
                  <div className={styles.previewNav}>
                    <button className={styles.previewNavBtn} disabled={previewIndex === 0}
                      onClick={() => setPreviewIndex(i => Math.max(0, i - 1))} aria-label="Previous recipient">‹</button>
                    <span className={styles.previewNavLabel}>
                      Previewing {previewIndex + 1} of {previewCount}
                      {activeRecipient?.first_name ? ` — ${activeRecipient.first_name}` : ""}
                    </span>
                    <button className={styles.previewNavBtn} disabled={previewIndex >= previewCount - 1}
                      onClick={() => setPreviewIndex(i => Math.min(previewCount - 1, i + 1))} aria-label="Next recipient">›</button>
                  </div>
                )}
              </div>

              <div className={styles.summaryList}>
                <div className={styles.summaryRow}><b>{targetDef?.label}</b></div>
              </div>
            </div>
          </div>
        )
      )}

      {confirmDialog}
    </Modal>
  );
}
