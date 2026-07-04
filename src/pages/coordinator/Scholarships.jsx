import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "./Scholarships.module.css";

// ─── helpers ────────────────────────────────────────────────
const STATUS_OPTIONS = ["Active", "Suspended", "Terminated"];

const STATUS_TONE = {
  Active:     s.badgeSuccess,
  Suspended:  s.badgeWarning,
  Terminated: s.badgeDanger,
};

export default function Scholarships() {
  // ── list / pagination / filter ──────────────────────────
  const [list,          setList]          = useState([]);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("All");
  const [sponsorFilter, setSponsorFilter] = useState("All");
  const [currentPage,   setCurrentPage]  = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── modal open state ────────────────────────────────────
  const [open,         setOpen]        = useState(false);
  const [viewOpen,     setViewOpen]    = useState(false);
  const [viewFormOpen, setViewFormOpen] = useState(false);
  const [editMode,     setEditMode]    = useState(false);
  const [editingId,    setEditingId]   = useState(null);

  // ── scholarship fields ──────────────────────────────────
  const [name,        setName]        = useState("");
  const [sponsor,     setSponsor]     = useState("");
  const [description, setDescription] = useState("");
  const [amount,      setAmount]      = useState("");
  const [slots,       setSlots]       = useState("");
  const [deadline,    setDeadline]    = useState("");

  // ── requirements ────────────────────────────────────────
  const [appReq,      setAppReq]      = useState([]);
  const [eligReq,     setEligReq]     = useState([]);
  const [selectedReq, setSelectedReq] = useState([]);
  const [newAppName,  setNewAppName]  = useState("");
  const [newAppType,  setNewAppType]  = useState("Document");
  const [newEligName, setNewEligName] = useState("");
  const [newEligType, setNewEligType] = useState("Other");
  const [showAppForm, setShowAppForm] = useState(false);
  const [showEligForm,setShowEligForm]= useState(false);

  // ── form builder ────────────────────────────────────────
  const [formTitle,  setFormTitle]  = useState("");
  const [terms,      setTerms]      = useState("");
  const [fields,     setFields]     = useState([]);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType,  setFieldType]  = useState("text");
  const [isRequired, setIsRequired] = useState(false);

  // ── view modals data ────────────────────────────────────
  const [viewRequirements, setViewRequirements] = useState({ application: [], eligibility: [] });
  const [formData,         setFormData]         = useState({ title: "", terms: "", fields: [] });

  // ────────────────────────────────────────────────────────
  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data }       = await supabase.from("scholarships").select("*");
    const { data: app }  = await supabase.from("application_requirements").select("*");
    const { data: elig } = await supabase.from("eligibility_requirements").select("*");
    setList(data || []);
    setAppReq(app   || []);
    setEligReq(elig || []);
  };

  // ── filters ─────────────────────────────────────────────
  const sponsors = ["All", ...new Set(list.map(s => s.sponsor).filter(Boolean))];

  const filtered = list.filter(s => {
    const kw = search.toLowerCase();
    const matchSearch =
      (s.scholarship_name || "").toLowerCase().includes(kw) ||
      (s.sponsor || "").toLowerCase().includes(kw) ||
      (s.description || "").toLowerCase().includes(kw) ||
      String(s.amount || "").includes(kw) ||
      (s.submission_deadline || "").includes(kw) ||
      (s.status || "").toLowerCase().includes(kw);
    return matchSearch &&
      (statusFilter  === "All" || s.status  === statusFilter) &&
      (sponsorFilter === "All" || s.sponsor === sponsorFilter);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── actions ─────────────────────────────────────────────
  const toggleStatus = async (sch) => {
    const next = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(sch.status) + 1) % STATUS_OPTIONS.length];
    const { error } = await supabase.from("scholarships").update({ status: next }).eq("scholarship_id", sch.scholarship_id);
    if (error) return alert(error.message);
    load();
  };

  const toggleReq = (id, type) => {
    const exists = selectedReq.find(r => r.id === id && r.type === type);
    setSelectedReq(exists
      ? selectedReq.filter(r => !(r.id === id && r.type === type))
      : [...selectedReq, { id, type }]);
  };

  const addApplicationRequirement = async () => {
    if (!newAppName.trim()) return;
    const { data, error } = await supabase.from("application_requirements")
      .insert({ requirement_name: newAppName, requirement_type: newAppType })
      .select().single();
    if (error) return alert(error.message);
    setAppReq([...appReq, data]);
    setSelectedReq([...selectedReq, { id: data.application_requirement_id, type: "app" }]);
    setNewAppName(""); setShowAppForm(false);
  };

  const addEligibilityRequirement = async () => {
    if (!newEligName.trim()) return;
    const { data, error } = await supabase.from("eligibility_requirements")
      .insert({ requirement_name: newEligName, requirement_type: newEligType })
      .select().single();
    if (error) return alert(error.message);
    setEligReq([...eligReq, data]);
    setSelectedReq([...selectedReq, { id: data.eligibility_requirement_id, type: "elig" }]);
    setNewEligName(""); setShowEligForm(false);
  };

  const addField = () => {
    if (!fieldLabel.trim()) return;
    setFields([...fields, { label: fieldLabel, type: fieldType, required: isRequired }]);
    setFieldLabel(""); setIsRequired(false);
  };

  const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i));

  const reset = () => {
    setName(""); setSponsor(""); setDescription(""); setAmount("");
    setSlots(""); setDeadline(""); setSelectedReq([]); setFormTitle("");
    setTerms(""); setFields([]);
  };

  const closeModal = () => {
    setOpen(false); setViewOpen(false); setViewFormOpen(false);
    reset(); setEditMode(false); setEditingId(null);
    setShowAppForm(false); setShowEligForm(false);
  };

  const editScholarship = async (sch) => {
    setEditMode(true); setEditingId(sch.scholarship_id);
    setName(sch.scholarship_name || ""); setSponsor(sch.sponsor || "");
    setDescription(sch.description || ""); setAmount(sch.amount || "");
    setSlots(sch.slots || ""); setDeadline(sch.submission_deadline || "");

    const { data: form } = await supabase.from("scholarship_application_forms")
      .select("*").eq("scholarship_id", sch.scholarship_id).single();
    if (form) {
      setFormTitle(form.form_title || ""); setTerms(form.terms_and_conditions || "");
      const { data: ff } = await supabase.from("scholarship_form_fields").select("*").eq("form_id", form.form_id);
      setFields((ff || []).map(f => ({ label: f.label, type: f.field_type, required: f.is_required })));
    }
    const { data: reqs } = await supabase.from("scholarship_requirements").select("*").eq("scholarship_id", sch.scholarship_id);
    if (reqs) setSelectedReq(reqs.map(r => ({ id: r.application_requirement_id || r.eligibility_requirement_id, type: r.application_requirement_id ? "app" : "elig" })));
    setOpen(true);
  };

  const createScholarship = async () => {
    if (!name || !formTitle || !terms) return alert("Name, form title, and terms are required");
    const { data: sch, error } = await supabase.from("scholarships")
      .insert({ scholarship_name: name, sponsor, description, amount: parseInt(amount || 0), slots: parseInt(slots || 0), submission_deadline: deadline, status: "Active" })
      .select().single();
    if (error) return alert(error.message);

    if (selectedReq.length) await supabase.from("scholarship_requirements").insert(
      selectedReq.map(r => ({ scholarship_id: sch.scholarship_id, application_requirement_id: r.type === "app" ? r.id : null, eligibility_requirement_id: r.type === "elig" ? r.id : null }))
    );

    const { data: form, error: fe } = await supabase.from("scholarship_application_forms")
      .insert({ scholarship_id: sch.scholarship_id, form_title: formTitle, terms_and_conditions: terms })
      .select().single();
    if (fe) return alert(fe.message);

    if (fields.length) await supabase.from("scholarship_form_fields").insert(
      fields.map(f => ({ form_id: form.form_id, label: f.label, field_type: f.type, is_required: f.required }))
    );
    reset(); setOpen(false); load();
  };

  const updateScholarship = async () => {
    if (!editingId) return alert("No scholarship selected");
    const { error } = await supabase.from("scholarships")
      .update({ scholarship_name: name, sponsor, description, amount: parseInt(amount || 0), slots: parseInt(slots || 0), submission_deadline: deadline })
      .eq("scholarship_id", editingId);
    if (error) return alert(error.message);

    await supabase.from("scholarship_requirements").delete().eq("scholarship_id", editingId);
    if (selectedReq.length) await supabase.from("scholarship_requirements").insert(
      selectedReq.map(r => ({ scholarship_id: editingId, application_requirement_id: r.type === "app" ? r.id : null, eligibility_requirement_id: r.type === "elig" ? r.id : null }))
    );

    const { data: form } = await supabase.from("scholarship_application_forms").select("form_id").eq("scholarship_id", editingId).single();
    if (form) {
      await supabase.from("scholarship_application_forms").update({ form_title: formTitle, terms_and_conditions: terms }).eq("form_id", form.form_id);
      await supabase.from("scholarship_form_fields").delete().eq("form_id", form.form_id);
      if (fields.length) await supabase.from("scholarship_form_fields").insert(
        fields.map(f => ({ form_id: form.form_id, label: f.label, field_type: f.type, is_required: f.required }))
      );
    }
    reset(); setOpen(false); setEditMode(false); setEditingId(null); load();
  };

  const viewRequirementsModal = async (id) => {
    const { data } = await supabase.from("scholarship_requirements")
      .select("application_requirements(requirement_name),eligibility_requirements(requirement_name)")
      .eq("scholarship_id", id);
    setViewRequirements({
      application: data?.filter(r => r.application_requirements).map(r => r.application_requirements.requirement_name) || [],
      eligibility: data?.filter(r => r.eligibility_requirements).map(r => r.eligibility_requirements.requirement_name) || [],
    });
    setViewOpen(true);
  };

  const viewForm = async (id) => {
    const { data: form, error } = await supabase.from("scholarship_application_forms").select("*").eq("scholarship_id", id).single();
    if (error || !form) return alert("No form found.");
    const { data: ff } = await supabase.from("scholarship_form_fields").select("*").eq("form_id", form.form_id);
    setFormData({ title: form.form_title, terms: form.terms_and_conditions, fields: ff || [] });
    setViewFormOpen(true);
  };

  // ── render ───────────────────────────────────────────────
  return (
    <div className={s.page}>
      {/* header */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Scholarships</h1>
          <p className={s.pageSubtitle}>Manage scholarships, requirements, and application forms</p>
        </div>
        <button className={s.btnPrimary} onClick={() => setOpen(true)}>+ Create Scholarship</button>
      </div>

      {/* filters */}
      <div className={s.filterRow}>
        <input className={s.searchInput} placeholder="Search scholarships…" value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
        <select className={s.filterSelect} value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Terminated">Terminated</option>
        </select>
        <select className={s.filterSelect} value={sponsorFilter}
          onChange={e => { setSponsorFilter(e.target.value); setCurrentPage(1); }}>
          {sponsors.map(sp => <option key={sp} value={sp}>{sp === "All" ? "All Sponsors" : sp}</option>)}
        </select>
      </div>

      {/* table */}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              {["Name","Sponsor","Description","Amount","Slots","Deadline","Status","Reqs","Form","Action"]
                .map(h => <th key={h} className={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {paginated.map(sch => (
              <tr key={sch.scholarship_id} className={s.tr}>
                <td className={s.td}>{sch.scholarship_name}</td>
                <td className={s.td}>{sch.sponsor}</td>
                <td className={s.tdDesc}>{sch.description}</td>
                <td className={s.td}>₱{Number(sch.amount || 0).toLocaleString()}</td>
                <td className={s.td}>{sch.slots}</td>
                <td className={s.td}>{sch.submission_deadline || "—"}</td>
                <td className={s.td}>
                  <button className={`${s.badge} ${STATUS_TONE[sch.status] || s.badgeNeutral}`}
                    onClick={() => toggleStatus(sch)}>
                    {sch.status}
                  </button>
                </td>
                <td className={s.td}>
                  <button className={s.btnSm} onClick={() => viewRequirementsModal(sch.scholarship_id)}>View</button>
                </td>
                <td className={s.td}>
                  <button className={s.btnSm} onClick={() => viewForm(sch.scholarship_id)}>View</button>
                </td>
                <td className={s.td}>
                  <button className={s.btnSm} onClick={() => editScholarship(sch)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className={s.pagination}>
        <span className={s.pageInfo}>
          {filtered.length === 0 ? "0" : `${(currentPage-1)*ITEMS_PER_PAGE+1}–${Math.min(currentPage*ITEMS_PER_PAGE, filtered.length)}`} of {filtered.length}
        </span>
        <div className={s.pageButtons}>
          <button className={s.pageBtn} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p-1)}>Previous</button>
          <span className={s.pageInfo}>Page {totalPages === 0 ? 0 : currentPage} of {totalPages || 1}</span>
          <button className={s.pageBtn} disabled={currentPage >= totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p+1)}>Next</button>
        </div>
      </div>

      {/* ── View Requirements Modal ── */}
      {viewOpen && (
        <div className={s.overlay} onMouseDown={e => e.target === e.currentTarget && closeModal()}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>Requirements</h2>
              <button className={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <div className={s.modalBody}>
              <h3 className={s.sectionLabel}>Application Requirements</h3>
              {viewRequirements.application.length === 0
                ? <p className={s.empty}>None</p>
                : viewRequirements.application.map((r, i) => <div key={i} className={s.listItem}>• {r}</div>)}
              <h3 className={s.sectionLabel}>Eligibility Requirements</h3>
              {viewRequirements.eligibility.length === 0
                ? <p className={s.empty}>None</p>
                : viewRequirements.eligibility.map((r, i) => <div key={i} className={s.listItem}>• {r}</div>)}
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Form Modal ── */}
      {viewFormOpen && (
        <div className={s.overlay} onMouseDown={e => e.target === e.currentTarget && closeModal()}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>{formData.title}</h2>
              <button className={s.closeBtn} onClick={closeModal}>✕</button>
            </div>
            <div className={s.modalBody}>
              <h3 className={s.sectionLabel}>Terms &amp; Conditions</h3>
              <p className={s.termsText}>{formData.terms}</p>
              <h3 className={s.sectionLabel}>Form Fields</h3>
              {formData.fields.length === 0
                ? <p className={s.empty}>No fields.</p>
                : formData.fields.map(f => (
                  <div key={f.field_id} className={s.fieldPreview}>
                    <strong>{f.label}</strong>
                    <span className={s.fieldMeta}>Type: {f.field_type} · Required: {f.is_required ? "Yes" : "No"}</span>
                  </div>
                ))}
            </div>
            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {open && (
        <div className={s.overlay} onMouseDown={e => e.target === e.currentTarget && closeModal()}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>{editMode ? "Edit Scholarship" : "Create Scholarship"}</h2>
              <button className={s.closeBtn} onClick={closeModal}>✕</button>
            </div>

            <div className={s.modalBody}>
              {/* Scholarship Info */}
              <section className={s.section}>
                <h3 className={s.sectionTitle}>Scholarship Information</h3>
                <div className={s.formGrid}>
                  {/* Each input is a plain <input> bound to its own state atom —
                      NO inline style objects, NO spread into style={{}} in JSX.
                      This is the fix for the cursor-jump bug: style objects
                      defined outside the component (in the CSS module) have
                      stable references and never cause React to remount inputs. */}
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Scholarship Name</label>
                    <input className={s.input} placeholder="e.g. Academic Excellence Award"
                      value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Sponsor</label>
                    <input className={s.input} placeholder="e.g. DOST" value={sponsor} onChange={e => setSponsor(e.target.value)} />
                  </div>
                  <div className={s.fieldWrapFull}>
                    <label className={s.label}>Description</label>
                    <textarea className={s.textarea} placeholder="Brief description…" value={description} onChange={e => setDescription(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Amount per grantee (₱)</label>
                    <input className={s.input} placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Slots available</label>
                    <input className={s.input} type="number" placeholder="e.g. 20" value={slots} onChange={e => setSlots(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Submission deadline</label>
                    <input className={s.input} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Requirements */}
              <section className={s.section}>
                <h3 className={s.sectionTitle}>Requirements</h3>

                <div className={s.reqGroup}>
                  <h4 className={s.reqGroupTitle}>Application Requirements</h4>
                  {appReq.map(r => (
                    <label key={r.application_requirement_id} className={s.checkItem}>
                      <input type="checkbox"
                        checked={selectedReq.some(x => x.id === r.application_requirement_id && x.type === "app")}
                        onChange={() => toggleReq(r.application_requirement_id, "app")} />
                      {r.requirement_name}
                    </label>
                  ))}
                  <button className={s.addBtn} onClick={() => setShowAppForm(!showAppForm)}>+ New requirement</button>
                  {showAppForm && (
                    <div className={s.inlineForm}>
                      <input className={s.input} placeholder="Requirement name" value={newAppName} onChange={e => setNewAppName(e.target.value)} />
                      <select className={s.input} value={newAppType} onChange={e => setNewAppType(e.target.value)}>
                        <option>Document</option><option>Grade</option><option>Income</option><option>Other</option>
                      </select>
                      <button className={s.btnSm} onClick={addApplicationRequirement}>Save</button>
                    </div>
                  )}
                </div>

                <div className={s.reqGroup}>
                  <h4 className={s.reqGroupTitle}>Eligibility Requirements</h4>
                  {eligReq.map(r => (
                    <label key={r.eligibility_requirement_id} className={s.checkItem}>
                      <input type="checkbox"
                        checked={selectedReq.some(x => x.id === r.eligibility_requirement_id && x.type === "elig")}
                        onChange={() => toggleReq(r.eligibility_requirement_id, "elig")} />
                      {r.requirement_name}
                    </label>
                  ))}
                  <button className={s.addBtn} onClick={() => setShowEligForm(!showEligForm)}>+ New requirement</button>
                  {showEligForm && (
                    <div className={s.inlineForm}>
                      <input className={s.input} placeholder="Requirement name" value={newEligName} onChange={e => setNewEligName(e.target.value)} />
                      <select className={s.input} value={newEligType} onChange={e => setNewEligType(e.target.value)}>
                        <option>Status</option><option>Other</option>
                      </select>
                      <button className={s.btnSm} onClick={addEligibilityRequirement}>Save</button>
                    </div>
                  )}
                </div>
              </section>

              {/* Form Builder */}
              <section className={s.section}>
                <h3 className={s.sectionTitle}>Application Form</h3>
                <div className={s.fieldWrapFull}>
                  <label className={s.label}>Form title</label>
                  <input className={s.input} placeholder="e.g. Academic Excellence Application" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                </div>
                <div className={s.fieldWrapFull}>
                  <label className={s.label}>Terms &amp; Conditions</label>
                  <textarea className={s.textarea} placeholder="Enter terms here…" value={terms} onChange={e => setTerms(e.target.value)} />
                </div>

                <h4 className={s.reqGroupTitle}>Form Fields</h4>
                {fields.map((f, i) => (
                  <div key={i} className={s.fieldPreview}>
                    <span><strong>{f.label}</strong> ({f.type}){f.required ? " *" : ""}</span>
                    <button className={s.removeBtn} onClick={() => removeField(i)}>Remove</button>
                  </div>
                ))}

                <div className={s.fieldBuilder}>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Field label</label>
                    <input className={s.input} placeholder="e.g. GPA" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Type</label>
                    <select className={s.input} value={fieldType} onChange={e => setFieldType(e.target.value)}>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="file">File</option>
                    </select>
                  </div>
                  <div className={s.checkRow}>
                    <label className={s.checkItem}>
                      <input type="checkbox" checked={isRequired} onChange={() => setIsRequired(!isRequired)} />
                      Required
                    </label>
                    <button className={s.addBtn} onClick={addField}>+ Add field</button>
                  </div>
                </div>
              </section>
            </div>

            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={closeModal}>Cancel</button>
              <button className={s.btnPrimary} onClick={editMode ? updateScholarship : createScholarship}>
                {editMode ? "Update" : "Save Scholarship"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
