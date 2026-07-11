import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./Requirements.module.css";

export default function Requirements() {
  const [appReq,  setAppReq]  = useState([]);
  const [eligReq, setEligReq] = useState([]);

  const [appName, setAppName] = useState("");
  const [eligName,setEligName]= useState("");

  const [appType, setAppType] = useState("Document");
  const [eligType,setEligType]= useState("Other");

  const [appDesc, setAppDesc] = useState("");
  const [eligDesc,setEligDesc]= useState("");

  // ── app requirement templates ─────────────────────────────
  const [appTemplates,      setAppTemplates]      = useState([]);
  const [showAppTplPicker,  setShowAppTplPicker]  = useState(false);
  const [showAppSaveTpl,    setShowAppSaveTpl]    = useState(false);
  const [appTplName,        setAppTplName]        = useState("");
  const [savingAppTpl,      setSavingAppTpl]      = useState(false);
  // which app reqs are currently checked (for template save/load)
  const [checkedApp,        setCheckedApp]        = useState([]);

  // ── elig requirement templates ────────────────────────────
  const [eligTemplates,     setEligTemplates]     = useState([]);
  const [showEligTplPicker, setShowEligTplPicker] = useState(false);
  const [showEligSaveTpl,   setShowEligSaveTpl]   = useState(false);
  const [eligTplName,       setEligTplName]       = useState("");
  const [savingEligTpl,     setSavingEligTpl]     = useState(false);
  const [checkedElig,       setCheckedElig]       = useState([]);

  // ── application form builder ──────────────────────────────
  const [formTitle,   setFormTitle]   = useState("");
  const [formTerms,   setFormTerms]   = useState("");
  const [formFields,  setFormFields]  = useState([]);
  const [fieldLabel,  setFieldLabel]  = useState("");
  const [fieldType,   setFieldType]   = useState("text");
  const [fieldRequired, setFieldRequired] = useState(false);

  const [formTemplates,     setFormTemplates]     = useState([]);
  const [formTplName,       setFormTplName]       = useState("");
  const [savingFormTpl,     setSavingFormTpl]     = useState(false);
  const [editingFormTplId,  setEditingFormTplId]  = useState(null);

  useEffect(() => { load(); loadTemplates(); }, []);

  const load = async () => {
    const [{ data: app }, { data: elig }] = await Promise.all([
      supabase.from("application_requirements").select("*"),
      supabase.from("eligibility_requirements").select("*"),
    ]);
    setAppReq(app   || []);
    setEligReq(elig || []);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("report_templates")
      .select("*")
      .order("created_at", { ascending: true });

    const all = data || [];
    setAppTemplates( all.filter(t => t.layout?.type === "app_req_template"));
    setEligTemplates(all.filter(t => t.layout?.type === "elig_req_template"));
    setFormTemplates(all.filter(t => t.layout?.type === "form_template"));
  };

  // ── Application form builder actions ──────────────────────
  const addFormField = () => {
    if (!fieldLabel.trim()) return;
    setFormFields(prev => [...prev, { label: fieldLabel, type: fieldType, required: fieldRequired }]);
    setFieldLabel(""); setFieldType("text"); setFieldRequired(false);
  };

  const removeFormField = (index) => {
    setFormFields(prev => prev.filter((_, i) => i !== index));
  };

  const resetFormBuilder = () => {
    setFormTitle(""); setFormTerms(""); setFormFields([]);
    setFormTplName(""); setEditingFormTplId(null);
  };

  const saveFormTemplate = async () => {
    if (!formTplName.trim()) { alert("Enter a name for this form template."); return; }
    if (!formTitle.trim()) { alert("Give the form a title."); return; }
    if (formFields.length === 0) { alert("Add at least one field to the form."); return; }

    setSavingFormTpl(true);
    const layout = { type: "form_template", formTitle, terms: formTerms, fields: formFields };

    if (editingFormTplId) {
      const { error } = await supabase.from("report_templates")
        .update({ name: formTplName, layout })
        .eq("template_id", editingFormTplId);
      if (error) { alert(error.message); setSavingFormTpl(false); return; }
      setFormTemplates(prev => prev.map(t => t.template_id === editingFormTplId ? { ...t, name: formTplName, layout } : t));
    } else {
      const { data, error } = await supabase.from("report_templates")
        .insert({ name: formTplName, layout }).select().single();
      if (error) { alert(error.message); setSavingFormTpl(false); return; }
      if (data) setFormTemplates(prev => [...prev, data]);
    }
    setSavingFormTpl(false);
    resetFormBuilder();
  };

  const loadFormTemplateIntoBuilder = (tpl) => {
    setFormTitle(tpl.layout?.formTitle || "");
    setFormTerms(tpl.layout?.terms || "");
    setFormFields(tpl.layout?.fields || []);
    setFormTplName(tpl.name || "");
    setEditingFormTplId(tpl.template_id);
  };

  const deleteFormTemplate = async (id) => {
    if (!confirm("Delete this form template?")) return;
    await supabase.from("report_templates").delete().eq("template_id", id);
    setFormTemplates(prev => prev.filter(t => t.template_id !== id));
    if (editingFormTplId === id) resetFormBuilder();
  };

  // ── Application requirement CRUD ─────────────────────────
  const addApp = async () => {
    if (!appName.trim()) return;
    const { error } = await supabase.from("application_requirements").insert({
      requirement_name: appName,
      requirement_type: appType,
      description:      appDesc || null,
    });
    if (error) { alert(error.message); return; }
    setAppName(""); setAppDesc("");
    load();
  };

  const deleteApp = async (id) => {
    if (!confirm("Delete this requirement?")) return;
    await supabase.from("application_requirements").delete()
      .eq("application_requirement_id", id);
    load();
  };

  // ── Eligibility requirement CRUD ──────────────────────────
  const addElig = async () => {
    if (!eligName.trim()) return;
    const { error } = await supabase.from("eligibility_requirements").insert({
      requirement_name: eligName,
      requirement_type: eligType,
      description:      eligDesc || null,
    });
    if (error) { alert(error.message); return; }
    setEligName(""); setEligDesc("");
    load();
  };

  const deleteElig = async (id) => {
    if (!confirm("Delete this requirement?")) return;
    await supabase.from("eligibility_requirements").delete()
      .eq("eligibility_requirement_id", id);
    load();
  };

  // ── App template actions ──────────────────────────────────
  const saveAppTemplate = async () => {
    if (!appTplName.trim()) return;
    if (checkedApp.length === 0) {
      alert("Check at least one requirement to include in the template.");
      return;
    }
    setSavingAppTpl(true);
    const selected = appReq.filter(r => checkedApp.includes(r.application_requirement_id));
    const { data } = await supabase.from("report_templates").insert({
      name:   appTplName,
      layout: {
        type:         "app_req_template",
        requirements: selected.map(r => ({
          name: r.requirement_name,
          type: r.requirement_type,
          desc: r.description,
        })),
      },
    }).select().single();
    if (data) setAppTemplates(prev => [...prev, data]);
    setSavingAppTpl(false);
    setAppTplName(""); setShowAppSaveTpl(false);
  };

  const applyAppTemplate = async (tpl) => {
    // Insert any requirements from the template that don't already exist
    const existing = new Set(appReq.map(r => r.requirement_name.toLowerCase()));
    const toInsert = (tpl.layout?.requirements || []).filter(
      r => !existing.has(r.name.toLowerCase())
    );
    if (toInsert.length > 0) {
      const { error } = await supabase.from("application_requirements").insert(
        toInsert.map(r => ({ requirement_name: r.name, requirement_type: r.type, description: r.desc || null }))
      );
      if (error) { alert(error.message); return; }
      await load();
    }
    setShowAppTplPicker(false);
    const msg = toInsert.length > 0
      ? `${toInsert.length} requirement${toInsert.length !== 1 ? "s" : ""} added from template.`
      : "All requirements from this template already exist.";
    alert(msg);
  };

  const deleteAppTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("report_templates").delete().eq("template_id", id);
    setAppTemplates(prev => prev.filter(t => t.template_id !== id));
  };

  // ── Elig template actions ─────────────────────────────────
  const saveEligTemplate = async () => {
    if (!eligTplName.trim()) return;
    if (checkedElig.length === 0) {
      alert("Check at least one requirement to include in the template.");
      return;
    }
    setSavingEligTpl(true);
    const selected = eligReq.filter(r => checkedElig.includes(r.eligibility_requirement_id));
    const { data } = await supabase.from("report_templates").insert({
      name:   eligTplName,
      layout: {
        type:         "elig_req_template",
        requirements: selected.map(r => ({
          name: r.requirement_name,
          type: r.requirement_type,
          desc: r.description,
        })),
      },
    }).select().single();
    if (data) setEligTemplates(prev => [...prev, data]);
    setSavingEligTpl(false);
    setEligTplName(""); setShowEligSaveTpl(false);
  };

  const applyEligTemplate = async (tpl) => {
    const existing = new Set(eligReq.map(r => r.requirement_name.toLowerCase()));
    const toInsert = (tpl.layout?.requirements || []).filter(
      r => !existing.has(r.name.toLowerCase())
    );
    if (toInsert.length > 0) {
      const { error } = await supabase.from("eligibility_requirements").insert(
        toInsert.map(r => ({ requirement_name: r.name, requirement_type: r.type, description: r.desc || null }))
      );
      if (error) { alert(error.message); return; }
      await load();
    }
    setShowEligTplPicker(false);
    const msg = toInsert.length > 0
      ? `${toInsert.length} requirement${toInsert.length !== 1 ? "s" : ""} added from template.`
      : "All requirements from this template already exist.";
    alert(msg);
  };

  const deleteEligTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("report_templates").delete().eq("template_id", id);
    setEligTemplates(prev => prev.filter(t => t.template_id !== id));
  };

  // ── toggle checked items ──────────────────────────────────
  const toggleCheckedApp = (id) =>
    setCheckedApp(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCheckedElig = (id) =>
    setCheckedElig(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Requirement Library</h1>
          <p className={styles.subtitle}>
            Manage application and eligibility requirements used across scholarships.
          </p>
        </div>
      </div>

      <div className={styles.grid}>

        {/* ── APPLICATION REQUIREMENTS ── */}
        <div className={styles.card}>
          <h2 className={styles.heading}>Application Requirements</h2>

          {/* add form */}
          <input
            className={styles.input}
            value={appName}
            placeholder="Requirement name *"
            onChange={e => setAppName(e.target.value)}
          />

          <div className={styles.row}>
            {["Grade", "Income", "Document", "Other"].map(t => (
              <button key={t} type="button"
                className={`${styles.typeBtn} ${appType === t ? styles.typeBtnActive : ""}`}
                onClick={() => setAppType(t)}>{t}</button>
            ))}
          </div>

          <textarea
            className={styles.textarea}
            value={appDesc}
            placeholder="Description (optional)"
            onChange={e => setAppDesc(e.target.value)}
          />

          <button className={styles.primaryBtn} onClick={addApp}>
            Add Requirement
          </button>

          <hr className={styles.divider} />

          {/* ── template controls ── */}
          <div className={styles.tplBar}>
            <h3 className={styles.savedTitle}>Saved Requirements</h3>
            <div className={styles.tplBtns}>
              <button className={styles.tplBtn}
                onClick={() => { setShowAppTplPicker(v => !v); setShowAppSaveTpl(false); }}>
                Load template
              </button>
              <button className={styles.tplBtnSecondary}
                onClick={() => { setShowAppSaveTpl(v => !v); setShowAppTplPicker(false); }}>
                Save as template
              </button>
            </div>
          </div>

          {/* template picker */}
          {showAppTplPicker && (
            <div className={styles.tplPicker}>
              {appTemplates.length === 0 ? (
                <p className={styles.tplEmpty}>No saved templates yet. Check some requirements below and save them.</p>
              ) : (
                appTemplates.map(t => (
                  <div key={t.template_id} className={styles.tplCard}>
                    <div className={styles.tplCardInfo}>
                      <strong className={styles.tplCardName}>{t.name}</strong>
                      <span className={styles.tplCardMeta}>
                        {t.layout?.requirements?.length || 0} requirement{t.layout?.requirements?.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className={styles.tplCardActions}>
                      <button className={styles.tplUseBtn} onClick={() => applyAppTemplate(t)}>Load</button>
                      <button className={styles.tplDelBtn} onClick={() => deleteAppTemplate(t.template_id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* save template row */}
          {showAppSaveTpl && (
            <div className={styles.tplSaveRow}>
              <input
                className={styles.input}
                placeholder="Template name e.g. Basic Document Set"
                value={appTplName}
                onChange={e => setAppTplName(e.target.value)}
              />
              <button className={styles.tplUseBtn} disabled={savingAppTpl} onClick={saveAppTemplate}>
                {savingAppTpl ? "Saving…" : "Save"}
              </button>
              <button className={styles.tplDelBtn}
                onClick={() => { setShowAppSaveTpl(false); setAppTplName(""); }}>
                Cancel
              </button>
            </div>
          )}

          {/* hint when save panel is open */}
          {showAppSaveTpl && (
            <p className={styles.tplHint}>
              Check the requirements below that you want to include in the template.
            </p>
          )}

          {/* requirement list */}
          <div className={styles.requirementList}>
            {[...appReq]
              .sort((a, b) => a.requirement_name.localeCompare(b.requirement_name))
              .map(r => (
                <div key={r.application_requirement_id} className={styles.requirementCard}>
                  <div className={styles.requirementHeader}>
                    <div className={styles.reqLeft}>
                      {/* checkbox shown when save-template panel is open */}
                      {showAppSaveTpl && (
                        <input
                          type="checkbox"
                          checked={checkedApp.includes(r.application_requirement_id)}
                          onChange={() => toggleCheckedApp(r.application_requirement_id)}
                          className={styles.reqCheck}
                        />
                      )}
                      <b>{r.requirement_name}</b>
                    </div>
                    <div className={styles.reqRight}>
                      <span className={styles.badge}>{r.requirement_type}</span>
                      <button className={styles.deleteBtn}
                        onClick={() => deleteApp(r.application_requirement_id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {r.description && (
                    <p className={styles.description}>{r.description}</p>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* ── ELIGIBILITY REQUIREMENTS ── */}
        <div className={styles.card}>
          <h2 className={styles.heading}>Eligibility Requirements</h2>

          <input
            className={styles.input}
            value={eligName}
            placeholder="Requirement name *"
            onChange={e => setEligName(e.target.value)}
          />

          <div className={styles.row}>
            {["Status", "Other"].map(t => (
              <button key={t} type="button"
                className={`${styles.typeBtn} ${eligType === t ? styles.typeBtnActive : ""}`}
                onClick={() => setEligType(t)}>{t}</button>
            ))}
          </div>

          <textarea
            className={styles.textarea}
            value={eligDesc}
            placeholder="Description (optional)"
            onChange={e => setEligDesc(e.target.value)}
          />

          <button className={styles.primaryBtn} onClick={addElig}>
            Add Requirement
          </button>

          <hr className={styles.divider} />

          {/* ── template controls ── */}
          <div className={styles.tplBar}>
            <h3 className={styles.savedTitle}>Saved Requirements</h3>
            <div className={styles.tplBtns}>
              <button className={styles.tplBtn}
                onClick={() => { setShowEligTplPicker(v => !v); setShowEligSaveTpl(false); }}>
                Load template
              </button>
              <button className={styles.tplBtnSecondary}
                onClick={() => { setShowEligSaveTpl(v => !v); setShowEligTplPicker(false); }}>
                Save as template
              </button>
            </div>
          </div>

          {/* template picker */}
          {showEligTplPicker && (
            <div className={styles.tplPicker}>
              {eligTemplates.length === 0 ? (
                <p className={styles.tplEmpty}>No saved templates yet. Check some requirements below and save them.</p>
              ) : (
                eligTemplates.map(t => (
                  <div key={t.template_id} className={styles.tplCard}>
                    <div className={styles.tplCardInfo}>
                      <strong className={styles.tplCardName}>{t.name}</strong>
                      <span className={styles.tplCardMeta}>
                        {t.layout?.requirements?.length || 0} requirement{t.layout?.requirements?.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className={styles.tplCardActions}>
                      <button className={styles.tplUseBtn} onClick={() => applyEligTemplate(t)}>Load</button>
                      <button className={styles.tplDelBtn} onClick={() => deleteEligTemplate(t.template_id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* save template row */}
          {showEligSaveTpl && (
            <div className={styles.tplSaveRow}>
              <input
                className={styles.input}
                placeholder="Template name e.g. IP Scholar Eligibility"
                value={eligTplName}
                onChange={e => setEligTplName(e.target.value)}
              />
              <button className={styles.tplUseBtn} disabled={savingEligTpl} onClick={saveEligTemplate}>
                {savingEligTpl ? "Saving…" : "Save"}
              </button>
              <button className={styles.tplDelBtn}
                onClick={() => { setShowEligSaveTpl(false); setEligTplName(""); }}>
                Cancel
              </button>
            </div>
          )}

          {showEligSaveTpl && (
            <p className={styles.tplHint}>
              Check the requirements below that you want to include in the template.
            </p>
          )}

          {/* requirement list */}
          <div className={styles.requirementList}>
            {[...eligReq]
              .sort((a, b) => a.requirement_name.localeCompare(b.requirement_name))
              .map(r => (
                <div key={r.eligibility_requirement_id} className={styles.requirementCard}>
                  <div className={styles.requirementHeader}>
                    <div className={styles.reqLeft}>
                      {showEligSaveTpl && (
                        <input
                          type="checkbox"
                          checked={checkedElig.includes(r.eligibility_requirement_id)}
                          onChange={() => toggleCheckedElig(r.eligibility_requirement_id)}
                          className={styles.reqCheck}
                        />
                      )}
                      <b>{r.requirement_name}</b>
                    </div>
                    <div className={styles.reqRight}>
                      <span className={styles.badge}>{r.requirement_type}</span>
                      <button className={styles.deleteBtn}
                        onClick={() => deleteElig(r.eligibility_requirement_id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {r.description && (
                    <p className={styles.description}>{r.description}</p>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* ── APPLICATION FORM TEMPLATES ── */}
        <div className={styles.card}>
          <h2 className={styles.heading}>
            {editingFormTplId ? "Edit Form Template" : "Create Form"}
          </h2>
          <p className={styles.description}>
            Build a reusable application form here, then load it from any scholarship's form builder.
          </p>

          <div className={styles.fieldWrapFull}>
            <label className={styles.label}>Form title</label>
            <input
              className={styles.input}
              placeholder="e.g. Academic Excellence Application"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
            />
          </div>

          <div className={styles.fieldWrapFull}>
            <label className={styles.label}>Terms &amp; Conditions</label>
            <textarea
              className={styles.textarea}
              placeholder="Enter terms here…"
              value={formTerms}
              onChange={e => setFormTerms(e.target.value)}
            />
          </div>

          <h3 className={styles.savedTitle}>Form Fields</h3>
          {formFields.length === 0 ? (
            <p className={styles.tplEmpty}>No fields yet. Add one below.</p>
          ) : (
            formFields.map((f, i) => (
              <div key={i} className={styles.fieldPreview}>
                <span><b>{f.label}</b> ({f.type}){f.required ? " *" : ""}</span>
                <button className={styles.removeBtn} onClick={() => removeFormField(i)}>Remove</button>
              </div>
            ))
          )}

          <div className={styles.fieldBuilder}>
            <div className={styles.fieldWrap}>
              <label className={styles.label}>Field label</label>
              <input
                className={styles.input}
                placeholder="e.g. GPA"
                value={fieldLabel}
                onChange={e => setFieldLabel(e.target.value)}
              />
            </div>
            <div className={styles.fieldWrap}>
              <label className={styles.label}>Type</label>
              <select className={styles.input} value={fieldType} onChange={e => setFieldType(e.target.value)}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="file">File</option>
              </select>
            </div>
            <div className={styles.checkRow}>
              <label className={styles.reqLeft}>
                <input type="checkbox" checked={fieldRequired} onChange={() => setFieldRequired(!fieldRequired)} />
                Required
              </label>
              <button className={styles.addBtn} onClick={addFormField}>+ Add field</button>
            </div>
          </div>

          <hr className={styles.divider} />

          <div className={styles.tplSaveRow}>
            <input
              className={styles.input}
              placeholder="Template name e.g. Standard Scholarship Form"
              value={formTplName}
              onChange={e => setFormTplName(e.target.value)}
            />
            <button className={styles.tplUseBtn} disabled={savingFormTpl} onClick={saveFormTemplate}>
              {savingFormTpl ? "Saving…" : editingFormTplId ? "Update template" : "Save as template"}
            </button>
            {editingFormTplId && (
              <button className={styles.tplDelBtn} onClick={resetFormBuilder}>Cancel edit</button>
            )}
          </div>

          <h3 className={styles.savedTitle}>Saved Form Templates</h3>
          <div className={styles.requirementList}>
            {formTemplates.length === 0 ? (
              <p className={styles.tplEmpty}>No saved form templates yet. Build a form above and save it.</p>
            ) : (
              formTemplates.map(t => (
                <div key={t.template_id} className={styles.tplCard}>
                  <div className={styles.tplCardInfo}>
                    <strong className={styles.tplCardName}>{t.name}</strong>
                    <span className={styles.tplCardMeta}>
                      {t.layout?.fields?.length || 0} field{t.layout?.fields?.length !== 1 ? "s" : ""}
                      {t.layout?.formTitle ? ` · "${t.layout.formTitle}"` : ""}
                    </span>
                  </div>
                  <div className={styles.tplCardActions}>
                    <button className={styles.tplUseBtn} onClick={() => loadFormTemplateIntoBuilder(t)}>Edit</button>
                    <button className={styles.tplDelBtn} onClick={() => deleteFormTemplate(t.template_id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
