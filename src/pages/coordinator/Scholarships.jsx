import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/context/ToastContext";
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
  const [currentPage,   setCurrentPage]   = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── modal open state ────────────────────────────────────
  const [open,         setOpen]        = useState(false);
  const [viewOpen,     setViewOpen]    = useState(false);
  const [viewFormOpen, setViewFormOpen] = useState(false);
  const [editMode,     setEditMode]    = useState(false);
  const [editingId,    setEditingId]   = useState(null);

  // ── scholarship fields ──────────────────────────────────
  const [name,           setName]           = useState("");
  const [sponsor,        setSponsor]        = useState("");
  const [description,    setDescription]    = useState("");
  const [amount,         setAmount]         = useState("");
  const [budget,         setBudget]         = useState("");
  const [slots,          setSlots]          = useState("");
  const [deadline,       setDeadline]       = useState("");
  const [payoutFreq,     setPayoutFreq]     = useState("Semester");
  const [duration,       setDuration]       = useState("Until Graduation");

  // ── requirements ────────────────────────────────────────
  const [appReq,       setAppReq]      = useState([]);
  const [eligReq,      setEligReq]     = useState([]);
  const [selectedReq,  setSelectedReq] = useState([]);
  const [newAppName,   setNewAppName]  = useState("");
  const [newAppType,   setNewAppType]  = useState("Document");
  const [newEligName,  setNewEligName] = useState("");
  const [newEligType,  setNewEligType] = useState("Other");
  const [showAppForm,  setShowAppForm] = useState(false);
  const [showEligForm, setShowEligForm]= useState(false);
  const [addingAppReq,  setAddingAppReq]  = useState(false);
  const [addingEligReq, setAddingEligReq] = useState(false);
  const [togglingId,    setTogglingId]    = useState(null);
  const [deletingTplId, setDeletingTplId] = useState(null);

  // ── form builder ────────────────────────────────────────
  const [formTitle,  setFormTitle]  = useState("");
  const [terms,      setTerms]      = useState("");
  const [fields,     setFields]     = useState([]);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType,  setFieldType]  = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);

  // ── form templates ───────────────────────────────────────
  const [formTemplates,    setFormTemplates]    = useState([]);
  const [showTplPicker,    setShowTplPicker]    = useState(false);
  const [savingTpl,        setSavingTpl]        = useState(false);
  const [showSaveTpl,      setShowSaveTpl]      = useState(false);
  const [tplName,          setTplName]          = useState("");

  // ── view modals data ────────────────────────────────────
  const [viewRequirements, setViewRequirements] = useState({ application: [], eligibility: [] });
  const [formData,         setFormData]         = useState({ title: "", terms: "", fields: [] });

  // ── confirm popup ────────────────────────────────────────
  const { askConfirm, confirmDialog } = useConfirm();
  const toast = useToast();

  // ────────────────────────────────────────────────────────
  useEffect(() => { load(); loadFormTemplates(); }, []);

  const load = async () => {
    const { data } = await supabase.from("scholarships").select(`
      *,
      grantees(fund_releases(amount_released))
    `);
    const { data: app }  = await supabase.from("application_requirements").select("*");
    const { data: elig } = await supabase.from("eligibility_requirements").select("*");
    setList(data || []);
    setAppReq(app  || []);
    setEligReq(elig || []);
  };

  const loadFormTemplates = async () => {
    const { data } = await supabase
      .from("report_templates")
      .select("*")
      .order("created_at", { ascending: true });
    // Only show templates tagged as form_template
    setFormTemplates((data || []).filter(t => t.layout?.type === "form_template"));
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

  // ── form template actions ────────────────────────────────
  const applyFormTemplate = (tpl) => {
    setFormTitle(tpl.layout?.formTitle || "");
    setTerms(tpl.layout?.terms || "");
    setFields(tpl.layout?.fields || []);
    setShowTplPicker(false);
  };

  const saveFormTemplate = async () => {
    if (savingTpl) return;
    if (!tplName.trim()) return;
    if (!formTitle.trim() && !terms.trim() && fields.length === 0) {
      toast.error("Fill in at least the form title before saving a template.");
      return;
    }
    setSavingTpl(true);
    const { data } = await supabase.from("report_templates")
      .insert({
        name: tplName,
        layout: {
          type:      "form_template",
          formTitle,
          terms,
          fields,
        },
      })
      .select().single();
    if (data) setFormTemplates(prev => [...prev, data]);
    setSavingTpl(false);
    setTplName("");
    setShowSaveTpl(false);
  };

  const deleteFormTemplate = (id) => {
    if (deletingTplId) return;
    askConfirm("Delete this template?", () => doDeleteFormTemplate(id), { variant: "danger", confirmLabel: "Delete" });
  };

  const doDeleteFormTemplate = async (id) => {
    setDeletingTplId(id);
    const { error } = await supabase.from("report_templates").delete().eq("template_id", id);
    setDeletingTplId(null);
    if (error) return toast.error(error.message);
    setFormTemplates(prev => prev.filter(t => t.template_id !== id));
  };

  // ── actions ─────────────────────────────────────────────
  const toggleStatus = async (sch) => {
    if (togglingId) return;
    setTogglingId(sch.scholarship_id);
    const next = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(sch.status) + 1) % STATUS_OPTIONS.length];
    const { error } = await supabase.from("scholarships").update({ status: next }).eq("scholarship_id", sch.scholarship_id);
    setTogglingId(null);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleReq = (id, type) => {
    const exists = selectedReq.find(r => r.id === id && r.type === type);
    setSelectedReq(exists
      ? selectedReq.filter(r => !(r.id === id && r.type === type))
      : [...selectedReq, { id, type }]);
  };

  const addApplicationRequirement = async () => {
    if (addingAppReq) return;
    if (!newAppName.trim()) return;
    setAddingAppReq(true);
    const { data, error } = await supabase.from("application_requirements")
      .insert({ requirement_name: newAppName, requirement_type: newAppType })
      .select().single();
    setAddingAppReq(false);
    if (error) return toast.error(error.message);
    setAppReq([...appReq, data]);
    setSelectedReq([...selectedReq, { id: data.application_requirement_id, type: "app" }]);
    setNewAppName(""); setShowAppForm(false);
  };

  const addEligibilityRequirement = async () => {
    if (addingEligReq) return;
    if (!newEligName.trim()) return;
    setAddingEligReq(true);
    const { data, error } = await supabase.from("eligibility_requirements")
      .insert({ requirement_name: newEligName, requirement_type: newEligType })
      .select().single();
    setAddingEligReq(false);
    if (error) return toast.error(error.message);
    setEligReq([...eligReq, data]);
    setSelectedReq([...selectedReq, { id: data.eligibility_requirement_id, type: "elig" }]);
    setNewEligName(""); setShowEligForm(false);
  };

  const addField = () => {
    if (!fieldLabel.trim()) return;
    if (editingFieldIndex !== null) {
      setFields(fields.map((f, idx) =>
        idx === editingFieldIndex
          ? { label: fieldLabel.trim(), type: fieldType, required: isRequired }
          : f
      ));
      setEditingFieldIndex(null);
    } else {
      setFields([...fields, { label: fieldLabel.trim(), type: fieldType, required: isRequired }]);
    }
    setFieldLabel(""); setFieldType("text"); setIsRequired(false);
  };

  const startEditField = (i) => {
    const f = fields[i];
    setFieldLabel(f.label);
    setFieldType(f.type);
    setIsRequired(f.required);
    setEditingFieldIndex(i);
  };

  const cancelFieldEdit = () => {
    setEditingFieldIndex(null);
    setFieldLabel(""); setFieldType("text"); setIsRequired(false);
  };

  const removeField = (i) => {
    setFields(fields.filter((_, idx) => idx !== i));
    if (editingFieldIndex === i) cancelFieldEdit();
  };

  const reset = () => {
    setName(""); setSponsor(""); setDescription(""); setAmount("");
    setBudget(""); setSlots(""); setDeadline("");
    setPayoutFreq("Semester"); setDuration("Until Graduation");
    setSelectedReq([]);
    setFormTitle(""); setTerms(""); setFields([]);
    setFieldLabel(""); setFieldType("text"); setIsRequired(false); setEditingFieldIndex(null);
    setShowTplPicker(false); setShowSaveTpl(false); setTplName("");
    setSaving(false);
  };

  const performClose = () => {
    setOpen(false); setViewOpen(false); setViewFormOpen(false);
    reset(); setEditMode(false); setEditingId(null);
    setShowAppForm(false); setShowEligForm(false);
  };

  const closeModal = () => {
    if (open) {
      askConfirm("Discard this scholarship form? Unsaved changes will be lost.", performClose);
      return;
    }
    performClose();
  };

  const editScholarship = async (sch) => {
    setEditMode(true); setEditingId(sch.scholarship_id);
    setName(sch.scholarship_name || ""); setSponsor(sch.sponsor || "");
    setDescription(sch.description || ""); setAmount(sch.amount || "");
    setBudget(sch.total_budget || "");
    setSlots(sch.slots || ""); setDeadline(sch.submission_deadline || "");
    setPayoutFreq(sch.payout_frequency || "Semester");
    setDuration(sch.duration_type || "Until Graduation");

    const { data: form } = await supabase.from("scholarship_application_forms")
      .select("*").eq("scholarship_id", sch.scholarship_id).single();
    if (form) {
      setFormTitle(form.form_title || ""); setTerms(form.terms_and_conditions || "");
      const { data: ff } = await supabase.from("scholarship_form_fields").select("*").eq("form_id", form.form_id);
      const deduped = Object.values(
        (ff || []).reduce((acc, f) => {
          const key = (f.label || "").trim();
          acc[key] = acc[key] || f; // keep first occurrence per trimmed label
          return acc;
        }, {})
      );
      setFields(deduped.map(f => ({ label: (f.label || "").trim(), type: f.field_type, required: f.is_required })));
    }
    const { data: reqs } = await supabase.from("scholarship_requirements").select("*").eq("scholarship_id", sch.scholarship_id);
    if (reqs) setSelectedReq(reqs.map(r => ({ id: r.application_requirement_id || r.eligibility_requirement_id, type: r.application_requirement_id ? "app" : "elig" })));
    setOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const createScholarship = () => {
    if (saving) return;
    if (!name || !formTitle || !terms) return toast.error("Name, form title, and terms are required");
    askConfirm("Save this new scholarship?", doCreateScholarship);
  };

  const doCreateScholarship = async () => {
    setSaving(true);
    const { data: sch, error } = await supabase.from("scholarships")
      .insert({ scholarship_name: name, sponsor, description, amount: parseFloat(amount || 0), total_budget: parseFloat(budget || 0), slots: parseInt(slots || 0), submission_deadline: deadline, payout_frequency: payoutFreq, duration_type: duration, status: "Active" })
      .select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }

    if (selectedReq.length) {
      const { error: reqErr } = await supabase.from("scholarship_requirements").insert(
        selectedReq.map(r => ({ scholarship_id: sch.scholarship_id, application_requirement_id: r.type === "app" ? r.id : null, eligibility_requirement_id: r.type === "elig" ? r.id : null }))
      );
      if (reqErr) toast.error("Scholarship saved, but requirements failed to attach: " + reqErr.message);
    }

    const { data: form, error: fe } = await supabase.from("scholarship_application_forms")
      .insert({ scholarship_id: sch.scholarship_id, form_title: formTitle, terms_and_conditions: terms })
      .select().single();
    if (fe) { toast.error(fe.message); setSaving(false); return; }

    if (fields.length) {
      const { error: fieldErr } = await supabase.from("scholarship_form_fields").insert(
        fields.map(f => ({ form_id: form.form_id, label: f.label, field_type: f.type, is_required: f.required }))
      );
      if (fieldErr) toast.error("Scholarship saved, but form fields failed to save: " + fieldErr.message);
    }
    setSaving(false);
    toast.success("Scholarship created.");
    reset(); setOpen(false); load();
  };

  const updateScholarship = () => {
    if (saving) return;
    if (!editingId) return toast.error("No scholarship selected");
    askConfirm("Save changes to this scholarship?", doUpdateScholarship);
  };

  const doUpdateScholarship = async () => {
    setSaving(true);

    const { error } = await supabase.from("scholarships")
      .update({ scholarship_name: name, sponsor, description, amount: parseFloat(amount || 0), total_budget: parseFloat(budget || 0), slots: parseInt(slots || 0), submission_deadline: deadline, payout_frequency: payoutFreq, duration_type: duration })
      .eq("scholarship_id", editingId);
    if (error) { toast.error(error.message); setSaving(false); return; }

    await supabase.from("scholarship_requirements").delete().eq("scholarship_id", editingId);
    if (selectedReq.length) {
      const { error: reqErr } = await supabase.from("scholarship_requirements").insert(
        selectedReq.map(r => ({ scholarship_id: editingId, application_requirement_id: r.type === "app" ? r.id : null, eligibility_requirement_id: r.type === "elig" ? r.id : null }))
      );
      if (reqErr) toast.error("Requirements failed to save: " + reqErr.message);
    }

    // Always get the form first
    const { data: form, error: formErr } = await supabase.from("scholarship_application_forms")
      .select("form_id").eq("scholarship_id", editingId).single();
    if (formErr) toast.error("Couldn't load this scholarship's form: " + formErr.message);

    if (form) {
      const { error: titleErr } = await supabase.from("scholarship_application_forms")
        .update({ form_title: formTitle, terms_and_conditions: terms })
        .eq("form_id", form.form_id);
      if (titleErr) toast.error("Form title/terms failed to save: " + titleErr.message);

      // Delete ALL existing fields first, wait for it to complete,
      // then insert the new set — prevents duplicate rows on repeated saves
      const { error: delErr } = await supabase.from("scholarship_form_fields").delete().eq("form_id", form.form_id);
      if (delErr) toast.error("Couldn't clear old form fields: " + delErr.message);

      if (fields.length) {
        const { error: insErr } = await supabase.from("scholarship_form_fields").insert(
          fields.map(f => ({ form_id: form.form_id, label: f.label, field_type: f.type, is_required: f.required }))
        );
        if (insErr) toast.error("Form fields failed to save: " + insErr.message);
      }
    }

    setSaving(false);
    toast.success("Scholarship updated.");
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
    if (error || !form) return toast.error("No form found.");
    const { data: ff } = await supabase.from("scholarship_form_fields").select("*").eq("form_id", form.form_id);
    const deduped = Object.values(
      (ff || []).reduce((acc, f) => {
        const key = (f.label || "").trim();
        acc[key] = acc[key] || f;
        return acc;
      }, {})
    );
    setFormData({ title: form.form_title, terms: form.terms_and_conditions, fields: deduped });
    setViewFormOpen(true);
  };

  const releasedAmount = (sch) => {
    if (!sch.grantees) return 0;
    return sch.grantees.reduce((total, grantee) => {
      const released = grantee.fund_releases || [];
      return total + released.reduce((sum, fund) => sum + Number(fund.amount_released || 0), 0);
    }, 0);
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
              {[
                { h: "Name" }, { h: "Sponsor" }, { h: "Description", optional: true },
                { h: "Amount" }, { h: "Budget", optional: true }, { h: "Released", optional: true },
                { h: "Remaining", optional: true }, { h: "Slots", optional: true },
                { h: "Deadline", optional: true }, { h: "Payout" }, { h: "Duration", optional: true },
                { h: "Status" }, { h: "Reqs", optional: true }, { h: "Form", optional: true }, { h: "Action" },
              ].map(({ h, optional }) => (
                <th key={h} className={`${s.th} ${optional ? s.colOptional : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(sch => (
              <tr key={sch.scholarship_id} className={s.tr}>
                <td className={s.td}>{sch.scholarship_name}</td>
                <td className={s.td}>{sch.sponsor}</td>
                <td className={`${s.td} ${s.colOptional}`}><div className={s.descriptionBox}>{sch.description}</div></td>
                <td className={s.td}>₱{Number(sch.amount || 0).toLocaleString()}</td>
                <td className={`${s.td} ${s.colOptional}`}>₱{Number(sch.total_budget || 0).toLocaleString()}</td>
                <td className={`${s.td} ${s.colOptional}`}>₱{releasedAmount(sch).toLocaleString()}</td>
                <td className={`${s.td} ${s.colOptional}`}>₱{(Number(sch.total_budget || 0) - releasedAmount(sch)).toLocaleString()}</td>
                <td className={`${s.td} ${s.colOptional}`}>{sch.slots}</td>
                <td className={`${s.td} ${s.colOptional}`}>{sch.submission_deadline || "—"}</td>
                <td className={s.td}>{sch.payout_frequency || "—"}</td>
                <td className={`${s.td} ${s.colOptional}`}>{sch.duration_type || "—"}</td>
                <td className={s.td}>
                  <button className={`${s.badge} ${STATUS_TONE[sch.status] || s.badgeNeutral}`}
                    disabled={togglingId === sch.scholarship_id}
                    onClick={() => toggleStatus(sch)}>
                    {togglingId === sch.scholarship_id ? "…" : sch.status}
                  </button>
                </td>
                <td className={`${s.td} ${s.colOptional}`}>
                  <button className={s.btnSm} onClick={() => viewRequirementsModal(sch.scholarship_id)}>View</button>
                </td>
                <td className={`${s.td} ${s.colOptional}`}>
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
                    <label className={s.label}>Total Budget (₱)</label>
                    <input className={s.input} type="number" placeholder="e.g. 500000" value={budget} onChange={e => setBudget(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Slots available</label>
                    <input className={s.input} type="number" placeholder="e.g. 20" value={slots} onChange={e => setSlots(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Submission deadline</label>
                    <input className={s.input} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Payout Frequency</label>
                    <select className={s.input} value={payoutFreq} onChange={e => setPayoutFreq(e.target.value)}>
                      <option value="Semester">Semester</option>
                      <option value="Annual">Annual</option>
                      <option value="Monthly">Monthly</option>
                      <option value="One-time">One-time</option>
                    </select>
                  </div>
                  <div className={s.fieldWrap}>
                    <label className={s.label}>Duration</label>
                    <select className={s.input} value={duration} onChange={e => setDuration(e.target.value)}>
                      <option value="1 Semester">1 Semester</option>
                      <option value="1 Academic Year">1 Academic Year</option>
                      <option value="2 Academic Years">2 Academic Years</option>
                      <option value="3 Academic Years">3 Academic Years</option>
                      <option value="4 Academic Years">4 Academic Years</option>
                      <option value="Until Graduation">Until Graduation</option>
                    </select>
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
                      <button className={s.btnSm} disabled={addingAppReq} onClick={addApplicationRequirement}>
                        {addingAppReq ? "Saving…" : "Save"}
                      </button>
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
                      <button className={s.btnSm} disabled={addingEligReq} onClick={addEligibilityRequirement}>
                        {addingEligReq ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Form Builder */}
              <section className={s.section}>
                {/* ── Form section header with template actions ── */}
                <div className={s.formSectionHead}>
                  <h3 className={s.sectionTitle}>Application Form</h3>
                  <div className={s.tplActions}>
                    <button className={s.tplBtn} onClick={() => { setShowTplPicker(v => !v); setShowSaveTpl(false); }}>
                      Load template
                    </button>
                    <button className={s.tplBtnSecondary} onClick={() => { setShowSaveTpl(v => !v); setShowTplPicker(false); }}>
                      Save as template
                    </button>
                  </div>
                </div>

                {/* ── Template picker ── */}
                {showTplPicker && (
                  <div className={s.tplPicker}>
                    {formTemplates.length === 0 ? (
                      <p className={s.tplEmpty}>No saved form templates yet. Build a form and save it to reuse it here.</p>
                    ) : (
                      formTemplates.map(t => (
                        <div key={t.template_id} className={s.tplCard}>
                          <div className={s.tplCardInfo}>
                            <strong className={s.tplCardName}>{t.name}</strong>
                            <span className={s.tplCardMeta}>
                              {t.layout?.fields?.length || 0} field{t.layout?.fields?.length !== 1 ? "s" : ""}
                              {t.layout?.formTitle ? ` · "${t.layout.formTitle}"` : ""}
                            </span>
                          </div>
                          <div className={s.tplCardActions}>
                            <button className={s.btnSm} onClick={() => applyFormTemplate(t)}>Use</button>
                            <button className={s.removeBtn} disabled={deletingTplId === t.template_id}
                              onClick={() => deleteFormTemplate(t.template_id)}>
                              {deletingTplId === t.template_id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── Save template row ── */}
                {showSaveTpl && (
                  <div className={s.inlineForm}>
                    <input className={s.input} placeholder="Template name e.g. Standard Scholarship Form"
                      value={tplName} onChange={e => setTplName(e.target.value)} />
                    <button className={s.btnSm} disabled={savingTpl} onClick={saveFormTemplate}>
                      {savingTpl ? "Saving…" : "Save"}
                    </button>
                    <button className={s.removeBtn} onClick={() => { setShowSaveTpl(false); setTplName(""); }}>
                      Cancel
                    </button>
                  </div>
                )}

                <div className={s.fieldWrapFull}>
                  <label className={s.label}>Form title</label>
                  <input className={s.input} placeholder="e.g. Academic Excellence Application" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                </div>
                <div className={s.fieldWrapFull}>
                  <label className={s.label}>Terms &amp; Conditions</label>
                  <textarea className={s.textarea} placeholder="Enter terms here…" value={terms} onChange={e => setTerms(e.target.value)} />
                </div>

                <h4 className={s.reqGroupTitle}>Form Fields</h4>
                {fields.map((f, i) =>
                  editingFieldIndex === i ? (
                    <div key={i} className={s.fieldBuilder} style={{ outline: "2px solid currentColor", outlineOffset: "2px" }}>
                      <div className={s.fieldWrap}>
                        <label className={s.label}>Field label</label>
                        <input className={s.input} placeholder="e.g. GPA" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} />
                      </div>
                      <div className={s.fieldWrap} style={{ maxWidth: "140px", flex: "0 0 140px" }}>
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
                        <button className={s.addBtn} onClick={addField}>Save changes</button>
                        <button className={s.removeBtn} onClick={cancelFieldEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className={s.fieldPreview} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                      <span><strong>{f.label}</strong> ({f.type}){f.required ? " *" : ""}</span>
                      <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "nowrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className={s.btnSm}
                          disabled={editingFieldIndex !== null}
                          onClick={() => startEditField(i)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={s.removeBtn}
                          disabled={editingFieldIndex !== null}
                          onClick={() => removeField(i)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                )}

                {editingFieldIndex === null && (
                  <div className={s.fieldBuilder}>
                    <div className={s.fieldWrap}>
                      <label className={s.label}>Field label</label>
                      <input className={s.input} placeholder="e.g. GPA" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} />
                    </div>
                    <div className={s.fieldWrap} style={{ maxWidth: "140px", flex: "0 0 140px" }}>
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
                      <button type="button" className={s.addBtn} onClick={addField}>+ Add field</button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={closeModal} disabled={saving}>Cancel</button>
              <button className={s.btnPrimary} onClick={editMode ? updateScholarship : createScholarship} disabled={saving}>
                {saving ? "Saving…" : editMode ? "Update" : "Save Scholarship"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM POPUP */}
      {confirmDialog}
    </div>
  );
}
