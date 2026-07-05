import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Target definitions ────────────────────────────────────────────────────
// Each target has a label, icon, description, and a resolver function that
// returns the array of user_ids to notify using the actual DB state.
const TARGETS = {
  all_students: {
    label: "All Students",
    
    desc:  "Every registered student",
    resolve: async () => {
      const { data } = await supabase.from("users").select("user_id").eq("role", "Student");
      return (data || []).map(u => u.user_id);
    },
  },
  all_grantees: {
    label: "All Active Grantees",

    desc:  "Every student currently on an active scholarship grant",
    resolve: async () => {
      const { data } = await supabase
        .from("grantees").select("students(user_id)").eq("status", "Active");
      return [...new Set((data || []).map(g => g.students?.user_id).filter(Boolean))];
    },
  },
  all_users: {
    label: "Everyone",
   
    desc:  "All students, coordinators, and cashiers",
    resolve: async () => {
      const { data } = await supabase.from("users").select("user_id");
      return (data || []).map(u => u.user_id);
    },
  },
  pending_compliance: {
    label: "Pending/Missing Compliance",
   
    desc:  "Grantees who have at least one Pending or Missing compliance record",
    resolve: async () => {
      // compliance_records → grantee_id → grantees → student_id → students → user_id
      const { data } = await supabase
        .from("compliance_records")
        .select("grantees(students(user_id))")
        .in("status", ["Pending", "Missing"]);
      const ids = (data || []).map(r => r.grantees?.students?.user_id).filter(Boolean);
      return [...new Set(ids)];
    },
  },
  pending_releases: {
    label: "Pending Fund Releases",
  
    desc:  "Grantees who have a fund release that hasn't been disbursed yet",
    resolve: async () => {
      // fund_releases → grantee_id → grantees → student_id → students → user_id
      const { data } = await supabase
        .from("fund_releases")
        .select("grantees(students(user_id))")
        .eq("status", "Pending");
      const ids = (data || []).map(r => r.grantees?.students?.user_id).filter(Boolean);
      return [...new Set(ids)];
    },
  },
  pending_applications: {
    label: "Pending Applicants",
    
    desc:  "Students who have submitted an application currently under review",
    resolve: async () => {
      // scholarship_applications → student_id → students → user_id
      const { data } = await supabase
        .from("scholarship_applications")
        .select("students(user_id)")
        .eq("status", "Pending");
      const ids = (data || []).map(r => r.students?.user_id).filter(Boolean);
      return [...new Set(ids)];
    },
  },
};

// ── Type definitions — determines which targets are available ─────────────
const TYPE_DEFS = {
  General: {
  
    desc:          "General information for a broad audience",
    targets:       ["all_students", "all_grantees", "all_users"],
    defaultTarget: "all_students",
    defaultTitle:  "General Announcement",
    defaultBody:   "Dear Students,\n\nWe would like to inform you that [details here].\n\nThank you.",
  },
  Reminder: {

    desc:          "Deadline or schedule reminders",
    targets:       ["all_students", "all_grantees", "all_users"],
    defaultTarget: "all_students",
    defaultTitle:  "Reminder: Scholarship Deadline",
    defaultBody:   "Dear Scholars,\n\nThis is a reminder that the deadline for [scholarship name] submission is on [date].\n\nPlease submit your requirements before the deadline to avoid disqualification.\n\nThank you.",
  },
  Compliance: {

    desc:          "Document submission notices — target all grantees or only those with issues",
    targets:       ["all_grantees", "pending_compliance"],
    defaultTarget: "pending_compliance",
    defaultTitle:  "Compliance Requirement Notice",
    defaultBody:   "Dear Scholar,\n\nPlease be advised that you have pending compliance requirements for your scholarship grant.\n\nKindly submit the required documents at the Scholarship Office on or before [date].\n\nFailure to comply may result in suspension of your scholarship benefits.\n\nThank you.",
  },
  Approval: {

    desc:          "Application status notifications",
    targets:       ["all_students", "pending_applications"],
    defaultTarget: "pending_applications",
    defaultTitle:  "Scholarship Application Update",
    defaultBody:   "Dear Scholar,\n\nWe would like to inform you of an update regarding your scholarship application.\n\nPlease visit the Scholarship Office for further instructions.\n\nThank you.",
  },
  Finance: {
   
    desc:          "Fund release schedules — target all grantees or only those awaiting release",
    targets:       ["all_grantees", "pending_releases"],
    defaultTarget: "pending_releases",
    defaultTitle:  "Scholarship Fund Release Notice",
    defaultBody:   "Dear Scholar,\n\nPlease be informed that the scholarship funds for [Academic Year] [Semester] will be released on [date] at [location].\n\nBring a valid school ID and a copy of this notice when claiming.\n\nThank you.",
  },
  Other: {
  
    desc:          "Custom announcements",
    targets:       ["all_students", "all_grantees", "all_users"],
    defaultTarget: "all_students",
    defaultTitle:  "",
    defaultBody:   "",
  },
};

const TYPES = Object.keys(TYPE_DEFS);

// ── Seed templates ────────────────────────────────────────────────────────
const SEED_TEMPLATES = TYPES.filter(t => t !== "Other").map(t => ({
  name:   TYPE_DEFS[t].icon + " " + t,
  layout: {
    title:  TYPE_DEFS[t].defaultTitle,
    body:   TYPE_DEFS[t].defaultBody,
    type:   t,
    target: TYPE_DEFS[t].defaultTarget,
  },
}));

export default function AnnouncementModal({ open, onClose }) {
  const [step,        setStep]        = useState("list");
  const [templates,   setTemplates]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [sentCount,   setSentCount]   = useState(0);

  // compose fields
  const [title,       setTitle]       = useState("");
  const [body,        setBody]        = useState("");
  const [type,        setType]        = useState("General");
  const [target,      setTarget]      = useState("all_students");

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

  const resetCompose = () => {
    setSent(false); setError(""); setPendingType(null);
    setShowSave(false); setTplName("");
  };

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
    } else {
      setTemplates(data);
    }
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
    const def = TYPE_DEFS[newType];
    // auto-switch target to the new type's default if current target isn't valid
    if (!def.targets.includes(target)) setTarget(def.defaultTarget);
    else setTarget(def.defaultTarget); // always reset to smart default

    // if body has been customised, ask before overwriting
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

  const deleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("report_templates").delete().eq("template_id", id);
    setTemplates(prev => prev.filter(t => t.template_id !== id));
  };

  const send = async () => {
    setError("");
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    setSending(true);
    try {
      const resolver = TARGETS[target]?.resolve;
      if (!resolver) throw new Error("Unknown target.");

      const userIds = await resolver();

      if (userIds.length === 0) {
        setError(`No recipients found for "${TARGETS[target]?.label}". Nobody matching this filter exists in the database right now.`);
        setSending(false);
        return;
      }

      const { error: insertError } = await supabase.from("notifications").insert(
        userIds.map(uid => ({
          user_id:           uid,
          title,
          message:           body,
          notification_type: type,
          is_read:           false,
        }))
      );
      if (insertError) throw insertError;

      setSentCount(userIds.length);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  if (!open) return null;

  const typeDef      = TYPE_DEFS[type] || TYPE_DEFS.General;
  const validTargets = typeDef.targets;
  const targetDef    = TARGETS[target];

  return (
    <div style={s.overlay} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        {/* ── header ── */}
        <div style={s.head}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {step === "compose" && (
              <button style={s.backBtn} onClick={() => { setStep("list"); resetCompose(); }}>← Back</button>
            )}
            <div>
              <h2 style={s.title}>{step === "list" ? "Announcements" : "Compose Announcement"}</h2>
              <p style={s.sub}>
                {step === "list" ? "Pick a template or start from scratch" : "Edit your message and choose who receives it"}
              </p>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>

          {/* ── STEP 1: template list ── */}
          {step === "list" && (
            <>
              <button style={s.blankBtn} onClick={composeBlank}> &nbsp;Start from scratch</button>

              <p style={s.sectionLabel}>Saved templates</p>

              {loading ? (
                <p style={{color:"var(--text-secondary)",fontSize:13}}>Loading templates…</p>
              ) : (
                <div style={s.tplGrid}>
                  {templates.map(t => {
                    const td = TYPE_DEFS[t.layout?.type] || TYPE_DEFS.General;
                    const tgt = TARGETS[t.layout?.target];
                    return (
                      <div key={t.template_id} style={s.tplCard}>
                        <div style={s.tplTypeRow}>
                          <span style={s.tplIcon}>{td.icon}</span>
                          <span style={s.tplType}>{t.layout?.type || "General"}</span>
                        </div>
                        <div style={s.tplName}>{t.name}</div>
                        {tgt && (
                          <div style={s.tplTarget}>{tgt.icon} {tgt.label}</div>
                        )}
                        <p style={s.tplPreview}>{(t.layout?.body || "").slice(0, 85)}…</p>
                        <div style={s.tplActions}>
                          <button style={s.useBtn} onClick={() => useTemplate(t)}>Use</button>
                          <button style={s.delBtn} onClick={() => deleteTemplate(t.template_id)}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
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
                  <h3 style={{margin:"0 0 6px",color:"var(--success-700)"}}>Announcement sent!</h3>
                  <p style={{margin:"0 0 4px",fontSize:15,fontWeight:700,color:"var(--text-primary)"}}>
                    {sentCount} recipient{sentCount !== 1 ? "s" : ""} notified
                  </p>
                  <p style={{margin:0,fontSize:13,color:"var(--text-secondary)"}}>
                    {TARGETS[target]?.icon} {TARGETS[target]?.label}
                  </p>
                  <button style={{...s.useBtn,marginTop:18}} onClick={() => { resetCompose(); setStep("list"); }}>
                    Back to templates
                  </button>
                </div>
              ) : (
                <div style={s.composeWrap}>

                  {/* type chips */}
                  <div style={s.field}>
                    <label style={s.label}>Announcement type</label>
                    <div style={s.chipRow}>
                      {TYPES.map(t => {
                        const td = TYPE_DEFS[t];
                        const active = type === t;
                        return (
                          <button key={t} onClick={() => handleTypeChange(t)} style={{
                            ...s.typeChip,
                            background:  active ? "var(--navy-600)"  : "var(--surface-muted)",
                            color:       active ? "#fff"             : "var(--text-primary)",
                            borderColor: active ? "var(--navy-600)"  : "var(--border)",
                            fontWeight:  active ? 700 : 500,
                          }}>
                            {td.icon} {t}
                          </button>
                        );
                      })}
                    </div>
                    <p style={s.hint}>{typeDef.icon} {typeDef.desc}</p>
                  </div>

                  {/* type-swap banner */}
                  {pendingType && (
                    <div style={s.swapBanner}>
                      <p style={{margin:0,fontSize:13,color:"var(--ink-800)"}}>
                        Switch to the <strong>{pendingType}</strong> default message, or keep what you've written?
                      </p>
                      <div style={{display:"flex",gap:8,marginTop:10}}>
                        <button style={s.useBtn} onClick={() => applyType(pendingType)}>
                          Use {TYPE_DEFS[pendingType].icon} {pendingType} template
                        </button>
                        <button style={s.ghostBtn} onClick={() => keepContent(pendingType)}>
                          Keep my message
                        </button>
                      </div>
                    </div>
                  )}

                  {/* target chips */}
                  <div style={s.field}>
                    <label style={s.label}>Send to</label>
                    <div style={s.chipRow}>
                      {validTargets.map(v => {
                        const td     = TARGETS[v];
                        const active = target === v;
                        // highlight "specific" targets differently
                        const isSpecific = ["pending_compliance","pending_releases","pending_applications"].includes(v);
                        return (
                          <button key={v} onClick={() => setTarget(v)} style={{
                            ...s.targetChip,
                            background:  active
                              ? isSpecific ? "var(--warning-100)" : "var(--navy-50)"
                              : "var(--surface-muted)",
                            color:       active
                              ? isSpecific ? "var(--warning-700)" : "var(--navy-700)"
                              : "var(--text-secondary)",
                            borderColor: active
                              ? isSpecific ? "var(--warning-600)" : "var(--navy-300)"
                              : "var(--border)",
                            fontWeight:  active ? 700 : 500,
                          }}>
                            {td?.icon} {td?.label}
                            {isSpecific && (
                              <span style={{
                                marginLeft:6,fontSize:10,fontWeight:700,padding:"1px 6px",
                                borderRadius:999,background:"var(--warning-600)",color:"#fff",
                              }}>SMART</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {targetDef && (
                      <p style={s.hint}>{targetDef.icon} {targetDef.desc}</p>
                    )}
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
                    <textarea style={{...s.inp, height:190, resize:"vertical", padding:12, lineHeight:1.65}}
                      value={body} placeholder="Type your announcement here…"
                      onChange={e => setBody(e.target.value)} />
                  </div>

                  {/* error */}
                  {error && (
                    <div style={{background:"var(--danger-50)",border:"1px solid var(--danger-100)",borderRadius:8,padding:"10px 14px",color:"var(--danger-700)",fontSize:13,fontWeight:600}}>
                      {error}
                    </div>
                  )}

                  {/* save as template */}
                  <div style={s.saveRow}>
                    {showSave ? (
                      <>
                        <input style={{...s.inp,flex:1,height:38}} placeholder="Template name…"
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
            <button
              style={{...s.sendBtn, opacity: sending ? .6 : 1, cursor: sending ? "not-allowed" : "pointer"}}
              disabled={sending} onClick={send}>
              {sending
                ? "Sending…"
                : `📢 Send to ${TARGETS[target]?.label || target}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay:     { position:"fixed",inset:0,background:"rgba(10,21,32,.55)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000 },
  modal:       { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,boxShadow:"0 20px 60px rgba(0,0,0,.25)",width:"100%",maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column" },

  head:        { display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px",borderBottom:"1px solid var(--border)",flexShrink:0 },
  title:       { margin:0,fontSize:18,fontWeight:700,color:"var(--text-primary)" },
  sub:         { margin:"3px 0 0",fontSize:13,color:"var(--text-secondary)" },
  closeBtn:    { width:32,height:32,border:"none",borderRadius:8,background:"var(--surface-muted)",color:"var(--text-secondary)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" },
  backBtn:     { padding:"6px 12px",background:"var(--surface-muted)",border:"1px solid var(--border-strong)",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",color:"var(--text-primary)",whiteSpace:"nowrap" },

  body:        { flex:1,overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:16 },
  foot:        { display:"flex",justifyContent:"flex-end",gap:10,padding:"14px 24px",borderTop:"1px solid var(--border)",flexShrink:0 },

  sectionLabel:{ margin:0,fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".4px" },
  hint:        { margin:0,fontSize:12,color:"var(--text-secondary)",lineHeight:1.5 },

  blankBtn:    { display:"flex",alignItems:"center",justifyContent:"center",padding:"14px 20px",background:"var(--navy-50)",border:"2px dashed var(--navy-300)",borderRadius:12,color:"var(--navy-700)",fontWeight:700,fontSize:14,cursor:"pointer",width:"100%",boxSizing:"border-box" },

  tplGrid:     { display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12 },
  tplCard:     { background:"var(--surface-muted)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:6 },
  tplTypeRow:  { display:"flex",alignItems:"center",gap:6 },
  tplIcon:     { fontSize:14 },
  tplType:     { fontSize:10,fontWeight:700,color:"var(--navy-600)",textTransform:"uppercase",letterSpacing:".4px" },
  tplName:     { fontSize:14,fontWeight:700,color:"var(--text-primary)" },
  tplTarget:   { fontSize:11,color:"var(--text-secondary)",fontWeight:600 },
  tplPreview:  { margin:0,fontSize:12,color:"var(--text-secondary)",lineHeight:1.5,flex:1 },
  tplActions:  { display:"flex",gap:8,marginTop:6 },

  composeWrap: { display:"flex",flexDirection:"column",gap:14 },
  field:       { display:"flex",flexDirection:"column",gap:6 },
  label:       { fontSize:11,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px" },
  inp:         { width:"100%",height:42,padding:"0 12px",boxSizing:"border-box",background:"var(--surface)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:10,fontSize:14,fontFamily:"inherit",outline:"none" },
  saveRow:     { display:"flex",gap:8,alignItems:"center" },

  chipRow:     { display:"flex",gap:8,flexWrap:"wrap" },
  typeChip:    { padding:"7px 14px",borderRadius:999,border:"1px solid",fontSize:13,cursor:"pointer",whiteSpace:"nowrap" },
  targetChip:  { display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:10,border:"1px solid",fontSize:13,cursor:"pointer",whiteSpace:"nowrap" },

  swapBanner:  { background:"var(--warning-50)",border:"1px solid var(--warning-100)",borderRadius:10,padding:"12px 16px" },

  useBtn:      { padding:"8px 16px",background:"var(--navy-600)",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" },
  delBtn:      { padding:"8px 12px",background:"var(--danger-50)",color:"var(--danger-700)",border:"1px solid var(--danger-100)",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer" },
  ghostBtn:    { padding:"8px 14px",background:"none",color:"var(--text-secondary)",border:"1px dashed var(--border-strong)",borderRadius:8,fontSize:13,cursor:"pointer" },

  cancelBtn:   { padding:"10px 18px",background:"var(--surface)",color:"var(--text-primary)",border:"1px solid var(--border-strong)",borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer" },
  sendBtn:     { padding:"10px 22px",background:"var(--navy-600)",color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14 },

  sentBox:     { display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",padding:"32px 20px",background:"var(--success-50)",border:"1px solid var(--success-100)",borderRadius:14 },
  sentIcon:    { width:52,height:52,borderRadius:"50%",background:"var(--success-600)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,marginBottom:12 },
};
