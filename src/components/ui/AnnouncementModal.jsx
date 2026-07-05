import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Default templates seeded on first open if the table is empty ──────────
const SEED_TEMPLATES = [
  {
    name: "General Announcement",
    layout: {
      title: "General Announcement",
      body:  "Dear Students,\n\nWe would like to inform you that [details here].\n\nThank you.",
      type:  "General",
    },
  },
  {
    name: "Deadline Reminder",
    layout: {
      title: "Reminder: Scholarship Deadline",
      body:  "Dear Scholars,\n\nThis is a reminder that the deadline for [scholarship name] submission is on [date].\n\nPlease submit your requirements before the deadline to avoid disqualification.\n\nThank you.",
      type:  "Reminder",
    },
  },
  {
    name: "Compliance Notice",
    layout: {
      title: "Compliance Requirement Notice",
      body:  "Dear [Name],\n\nPlease be advised that you have pending compliance requirements for your scholarship grant.\n\nKindly submit the required documents at the Scholarship Office on or before [date].\n\nThank you.",
      type:  "Compliance",
    },
  },
  {
    name: "Congratulations",
    layout: {
      title: "Congratulations!",
      body:  "Dear [Name],\n\nCongratulations! We are pleased to inform you that your scholarship application has been approved.\n\nPlease visit the Scholarship Office for further instructions.\n\nThank you.",
      type:  "Approval",
    },
  },
  {
    name: "Fund Release Notice",
    layout: {
      title: "Scholarship Fund Release",
      body:  "Dear Scholars,\n\nPlease be informed that the scholarship funds for [Academic Year] [Semester] will be released on [date] at [location].\n\nBring a valid ID and this notice when claiming.\n\nThank you.",
      type:  "Finance",
    },
  },
];

const TYPES = ["General", "Reminder", "Compliance", "Approval", "Finance", "Other"];

// Target audience options
const TARGETS = [
  { value: "all_students",   label: "All Students"      },
  { value: "all_grantees",   label: "Active Grantees"   },
  { value: "all_users",      label: "Everyone"          },
];

export default function AnnouncementModal({ open, onClose }) {
  const [step,       setStep]       = useState("list");   // list | compose
  const [templates,  setTemplates]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);

  // compose fields
  const [title,      setTitle]      = useState("");
  const [body,       setBody]       = useState("");
  const [type,       setType]       = useState("General");
  const [target,     setTarget]     = useState("all_students");

  // template management
  const [savingTpl,  setSavingTpl]  = useState(false);
  const [tplName,    setTplName]    = useState("");
  const [showSave,   setShowSave]   = useState(false);

  useEffect(() => {
    if (open) { loadTemplates(); setStep("list"); setSent(false); }
  }, [open]);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("report_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      // Seed defaults on first open
      const { data: seeded } = await supabase
        .from("report_templates")
        .insert(SEED_TEMPLATES.map(t => ({ name: t.name, layout: t.layout })))
        .select();
      setTemplates(seeded || []);
    } else {
      setTemplates(data);
    }
    setLoading(false);
  };

  const useTemplate = (tpl) => {
    setTitle(tpl.layout?.title || "");
    setBody(tpl.layout?.body  || "");
    setType(tpl.layout?.type  || "General");
    setStep("compose");
    setSent(false);
  };

  const composeBlank = () => {
    setTitle(""); setBody(""); setType("General");
    setStep("compose"); setSent(false);
  };

  const saveAsTemplate = async () => {
    if (!tplName.trim()) return;
    setSavingTpl(true);
    const { data } = await supabase
      .from("report_templates")
      .insert({ name: tplName, layout: { title, body, type } })
      .select().single();
    if (data) setTemplates(prev => [...prev, data]);
    setSavingTpl(false);
    setTplName("");
    setShowSave(false);
  };

  const deleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("report_templates").delete().eq("template_id", id);
    setTemplates(prev => prev.filter(t => t.template_id !== id));
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) return alert("Title and message are required.");
    setSending(true);

    try {
      // Resolve recipient user_ids based on target
      let userIds = [];

      if (target === "all_users") {
        const { data } = await supabase.from("users").select("user_id");
        userIds = (data || []).map(u => u.user_id);

      } else if (target === "all_students") {
        const { data } = await supabase.from("users").select("user_id").eq("role", "Student");
        userIds = (data || []).map(u => u.user_id);

      } else if (target === "all_grantees") {
        // Get user_ids of students who are active grantees
        const { data } = await supabase
          .from("grantees")
          .select("students(user_id)")
          .eq("status", "Active");
        userIds = [...new Set((data || []).map(g => g.students?.user_id).filter(Boolean))];
      }

      if (userIds.length === 0) {
        alert("No recipients found for the selected audience.");
        setSending(false);
        return;
      }

      // Batch insert notifications
      const notifications = userIds.map(uid => ({
        user_id:           uid,
        title,
        message:           body,
        notification_type: type,
        is_read:           false,
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      setSent(true);
    } catch (err) {
      alert(err.message);
    }

    setSending(false);
  };

  if (!open) return null;

  return (
    <div style={s.overlay} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        {/* header */}
        <div style={s.head}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {step === "compose" && (
              <button style={s.backBtn} onClick={() => setStep("list")}>← Back</button>
            )}
            <div>
              <h2 style={s.title}>
                {step === "list" ? "Announcements" : "Compose Announcement"}
              </h2>
              <p style={s.sub}>
                {step === "list"
                  ? "Pick a template or start from scratch"
                  : "Edit the message then choose who receives it"}
              </p>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>

          {/* ── STEP 1: template list ── */}
          {step === "list" && (
            <>
              <button style={s.blankBtn} onClick={composeBlank}>
                ✏️ &nbsp;Start from scratch
              </button>

              <p style={s.sectionLabel}>Saved templates</p>

              {loading ? (
                <p style={{color:"var(--text-secondary)",fontSize:13}}>Loading templates…</p>
              ) : (
                <div style={s.tplGrid}>
                  {templates.map(t => (
                    <div key={t.template_id} style={s.tplCard}>
                      <div style={s.tplType}>{t.layout?.type || "General"}</div>
                      <div style={s.tplName}>{t.name}</div>
                      <p style={s.tplPreview}>{(t.layout?.body || "").slice(0, 80)}…</p>
                      <div style={s.tplActions}>
                        <button style={s.useBtn} onClick={() => useTemplate(t)}>Use</button>
                        <button style={s.delBtn} onClick={() => deleteTemplate(t.template_id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: compose ── */}
          {step === "compose" && (
            <>
              {sent ? (
                <div style={s.sentBox}>
                  <div style={s.sentIcon}>✓</div>
                  <h3 style={{margin:"0 0 8px",color:"var(--success-700)"}}>Announcement sent!</h3>
                  <p style={{margin:0,fontSize:13,color:"var(--text-secondary)"}}>
                    All selected recipients have received this notification.
                  </p>
                  <button style={{...s.useBtn,marginTop:16}} onClick={() => { setSent(false); setStep("list"); }}>
                    Back to templates
                  </button>
                </div>
              ) : (
                <div style={s.composeWrap}>
                  {/* type + target row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <div style={s.field}>
                      <label style={s.label}>Type</label>
                      <select style={s.inp} value={type} onChange={e => setType(e.target.value)}>
                        {TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Send to</label>
                      <select style={s.inp} value={target} onChange={e => setTarget(e.target.value)}>
                        {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* title */}
                  <div style={s.field}>
                    <label style={s.label}>Subject / Title</label>
                    <input style={s.inp} value={title} placeholder="Announcement subject…"
                      onChange={e => setTitle(e.target.value)} />
                  </div>

                  {/* body */}
                  <div style={s.field}>
                    <label style={s.label}>Message</label>
                    <textarea style={{...s.inp, height:200, resize:"vertical", padding:12, lineHeight:1.6}}
                      value={body} placeholder="Type your announcement here…"
                      onChange={e => setBody(e.target.value)} />
                  </div>

                  {/* save as template */}
                  <div style={s.saveRow}>
                    {showSave ? (
                      <>
                        <input style={{...s.inp, flex:1, height:38}} placeholder="Template name…"
                          value={tplName} onChange={e => setTplName(e.target.value)} />
                        <button style={s.useBtn} disabled={savingTpl} onClick={saveAsTemplate}>
                          {savingTpl ? "Saving…" : "Save"}
                        </button>
                        <button style={s.delBtn} onClick={() => setShowSave(false)}>Cancel</button>
                      </>
                    ) : (
                      <button style={s.ghostBtn} onClick={() => setShowSave(true)}>
                        💾 Save as template
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        {step === "compose" && !sent && (
          <div style={s.foot}>
            <button style={s.cancelBtn} onClick={onClose} disabled={sending}>Cancel</button>
            <button style={{...s.sendBtn, opacity: sending ? .6 : 1, cursor: sending ? "not-allowed" : "pointer"}}
              disabled={sending} onClick={send}>
              {sending ? "Sending…" : "📢 Send announcement"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = {
  overlay: { position:"fixed",inset:0,background:"rgba(10,21,32,.55)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000 },
  modal:   { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,boxShadow:"0 20px 60px rgba(0,0,0,.25)",width:"100%",maxWidth:640,maxHeight:"88vh",display:"flex",flexDirection:"column" },

  head: { display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px",borderBottom:"1px solid var(--border)",flexShrink:0 },
  title:{ margin:0,fontSize:18,fontWeight:700,color:"var(--text-primary)" },
  sub:  { margin:"3px 0 0",fontSize:13,color:"var(--text-secondary)" },
  closeBtn:{ width:32,height:32,border:"none",borderRadius:8,background:"var(--surface-muted)",color:"var(--text-secondary)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" },
  backBtn: { padding:"6px 12px",background:"var(--surface-muted)",border:"1px solid var(--border-strong)",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",color:"var(--text-primary)",whiteSpace:"nowrap" },

  body: { flex:1,overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:16 },
  foot: { display:"flex",justifyContent:"flex-end",gap:10,padding:"14px 24px",borderTop:"1px solid var(--border)",flexShrink:0 },

  sectionLabel: { margin:0,fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".4px" },

  blankBtn: { display:"flex",alignItems:"center",justifyContent:"center",padding:"14px 20px",background:"var(--navy-50)",border:"2px dashed var(--navy-300)",borderRadius:12,color:"var(--navy-700)",fontWeight:700,fontSize:14,cursor:"pointer",width:"100%" },

  tplGrid: { display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12 },
  tplCard: { background:"var(--surface-muted)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:6 },
  tplType: { fontSize:10,fontWeight:700,color:"var(--navy-600)",textTransform:"uppercase",letterSpacing:".4px" },
  tplName: { fontSize:14,fontWeight:700,color:"var(--text-primary)" },
  tplPreview:{ margin:0,fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,flex:1 },
  tplActions:{ display:"flex",gap:8,marginTop:6 },

  composeWrap:{ display:"flex",flexDirection:"column",gap:14 },
  field: { display:"flex",flexDirection:"column",gap:5 },
  label: { fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px" },
  inp:   { width:"100%",height:42,padding:"0 12px",boxSizing:"border-box",background:"var(--surface)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:10,fontSize:14,fontFamily:"inherit",outline:"none" },
  saveRow:{ display:"flex",gap:8,alignItems:"center" },

  useBtn:  { padding:"8px 16px",background:"var(--navy-600)",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" },
  delBtn:  { padding:"8px 12px",background:"var(--danger-50)",color:"var(--danger-700)",border:"1px solid var(--danger-100)",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer" },
  ghostBtn:{ padding:"8px 14px",background:"none",color:"var(--text-secondary)",border:"1px dashed var(--border-strong)",borderRadius:8,fontSize:13,cursor:"pointer" },

  cancelBtn:{ padding:"10px 18px",background:"var(--surface)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer" },
  sendBtn:  { padding:"10px 22px",background:"var(--navy-600)",color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14 },

  sentBox:{ display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",padding:"32px 20px",background:"var(--success-50)",border:"1px solid var(--success-100)",borderRadius:14 },
  sentIcon:{ width:52,height:52,borderRadius:"50%",background:"var(--success-600)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,marginBottom:12 },
};
