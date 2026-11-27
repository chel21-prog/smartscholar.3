import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/context/ToastContext";
import { clearAllCached } from "@/lib/dataCache";
import { downloadJson, stamp } from "@/lib/backup";
import { notifyStudent } from "@/lib/scholarshipCancellation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import s from "./Accounts.module.css";

const TABS = [
  { id: "accounts",   label: "Accounts" },
  { id: "match",      label: "Match & bind" },
  { id: "duplicates", label: "Duplicates" },
  { id: "imports",    label: "Imports" },
  { id: "activity",   label: "Activity" },
];

const ROLES = ["Student", "Cashier", "Coordinator"];
const fullName = (p) => [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || "(no name)";
const norm = (v) => (v || "").trim().toLowerCase();
const nameKey = (p) => `${norm(p.first_name)}|${norm(p.last_name)}`;

const ACTION_LABELS = {
  role_changed: "Role changed", account_deactivated: "Account deactivated", account_reactivated: "Account reactivated",
  account_deleted: "Account deleted", records_linked: "Records linked to an account", link_approved: "Link request approved",
  link_rejected: "Link request rejected", duplicate_merged: "Duplicate merged", import_undone: "Import undone",
  import_done: "Import completed", grantee_edited: "Imported record edited",
};
const describe = (a) => {
  const d = a.details || {};
  switch (a.action) {
    case "role_changed": return `${d.name}: ${d.from} → ${d.to}`;
    case "account_deactivated": case "account_reactivated": return d.name || "";
    case "account_deleted": return `${d.name || ""}${d.email ? ` (${d.email})` : ""} · ${d.role || ""}`;
    case "records_linked": return `${d.imported} → ${d.account}`;
    case "link_approved": return `${d.imported_name} → School ID ${d.school_id}`;
    case "link_rejected": return d.school_id ? `School ID ${d.school_id}` : "";
    case "duplicate_merged": return d.name || "";
    case "import_undone": return `${d.grantees} grantees and ${d.people} people removed`;
    case "import_done": return `${d.rows} rows imported${d.created_people ? `, ${d.created_people} new people` : ""}`;
    case "grantee_edited": return d.name || "";
    default: return "";
  }
};

export default function Accounts() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useSession();
  const [tab, setTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [imported, setImported] = useState([]);
  const [dups, setDups] = useState([]);
  const [batches, setBatches] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setupMissing, setSetupMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, i, d, b, l] = await Promise.all([
      supabase.rpc("list_accounts"), supabase.rpc("list_imported_people"),
      supabase.rpc("find_duplicate_people"), supabase.rpc("list_import_batches"), supabase.rpc("list_audit_log", { p_limit: 200 }),
    ]);
    setSetupMissing(Boolean(a.error));
    setAccounts(a.data || []); setImported(i.data || []); setDups(d.data || []); setBatches(b.data || []); setAudit(l.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const afterChange = () => { clearAllCached(); load(); };

  return (
    <div className={s.page}>
      <button type="button" className={s.back} onClick={() => navigate("/coordinator/settings")}>← Back to Settings</button>
      <h1 className={s.title}>Account management</h1>
      <p className={s.subtitle}>Manage who can sign in, match imported records to real accounts, and review what changed.</p>

      {setupMissing && !loading && (
        <div className={s.notice}>
          The account tools aren't installed in the database yet. Run <code>supabase/claim_imported_student.sql</code>, then{" "}
          <code>supabase/account_management.sql</code>, in the Supabase SQL editor, then reload this page.
        </div>
      )}

      <div className={s.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`${s.tab} ${tab === t.id ? s.tabOn : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "match" && imported.length > 0 && <span className={s.count}>{imported.length}</span>}
            {t.id === "duplicates" && dups.length > 0 && <span className={s.count}>{new Set(dups.map((d) => d.group_key)).size}</span>}
          </button>
        ))}
      </div>

      {loading ? <div className={s.empty}>Loading…</div> : (
        <>
          {tab === "accounts" && <AccountsTab accounts={accounts} me={profile?.user_id} toast={toast} onChange={afterChange} />}
          {tab === "match" && <MatchTab imported={imported} accounts={accounts} toast={toast} onChange={afterChange} />}
          {tab === "duplicates" && <DuplicatesTab dups={dups} toast={toast} onChange={afterChange} />}
          {tab === "imports" && <ImportsTab batches={batches} toast={toast} onChange={afterChange} />}
          {tab === "activity" && <ActivityTab audit={audit} />}
        </>
      )}
    </div>
  );
}

// ───────────────────────────── Accounts
function AccountsTab({ accounts, me, toast, onChange }) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [confirm, setConfirm] = useState(null); // { kind: "delete" | "role", account, role? }
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const k = norm(q);
    return accounts.filter((a) =>
      (roleFilter === "All" || a.role === roleFilter) &&
      (!k || [fullName(a), a.email, a.school_id, a.course].some((v) => norm(v).includes(k))));
  }, [accounts, q, roleFilter]);

  const reasonText = {
    self: "You can't do that to your own account.",
    last_coordinator: "There has to be at least one active coordinator.",
    has_history: "This account has grantee or application records, so it can't be deleted. Deactivate it instead.",
    in_use: "Other records still depend on this account (for example a payout already released to it), so this can't be done. Deactivate it instead.",
    not_found: "That account no longer exists.",
  };

  const changeRole = async () => {
    setBusy(true);
    const a = confirm.account;
    if (a.role === "Student" && confirm.role !== "Student") {
      // leaving the Student role wipes their student data, so keep a copy first
      const [{ data: student }, { data: grants }, { data: apps }] = await Promise.all([
        supabase.from("students").select("*").eq("user_id", a.user_id).maybeSingle(),
        supabase.from("grantees").select("*").eq("student_id", a.student_id ?? -1),
        supabase.from("scholarship_applications").select("*").eq("student_id", a.student_id ?? -1),
      ]);
      downloadJson(`backup-student-${a.user_id}-${stamp()}.json`, { account: a, student, grantees: grants, applications: apps });
    }
    const { data, error } = await supabase.rpc("set_account_role", { p_user_id: confirm.account.user_id, p_role: confirm.role });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data?.ok) return toast.error(reasonText[data?.reason] || "Couldn't change the role.");
    toast.success(`${fullName(confirm.account)} is now a ${confirm.role}.`);
    setConfirm(null); onChange();
  };

  const toggleStatus = async (a) => {
    const next = (a.status || "active") === "active" ? "inactive" : "active";
    const { data, error } = await supabase.rpc("set_account_status", { p_user_id: a.user_id, p_status: next });
    if (error) return toast.error(error.message);
    if (!data?.ok) return toast.error(reasonText[data?.reason] || "Couldn't change the status.");
    toast.success(next === "inactive" ? `${fullName(a)} can no longer sign in.` : `${fullName(a)} can sign in again.`);
    onChange();
  };

  const deleteAccount = async () => {
    const a = confirm.account;
    setBusy(true);
    // a safety copy first, in case it was a mistake
    const [{ data: student }, { data: grants }] = await Promise.all([
      supabase.from("students").select("*").eq("user_id", a.user_id).maybeSingle(),
      supabase.from("grantees").select("*").eq("student_id", a.student_id ?? -1),
    ]);
    downloadJson(`backup-account-${a.user_id}-${stamp()}.json`, { account: a, student, grantees: grants });
    const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: a.user_id } });
    setBusy(false);
    if (error) {
      return toast.error("Couldn't reach the delete function. Deploy supabase/functions/delete-user first (see the notes), or deactivate the account instead.", 9000);
    }
    if (!data?.deleted) return toast.error(reasonText[data?.reason] || data?.error || "Couldn't delete this account.");
    if (data.login_deleted === false) toast.error("The profile was deleted but the sign-in could not be removed: " + (data.error || "unknown error"), 9000);
    else toast.success(`${fullName(a)} was deleted. A backup file was saved to your downloads.`);
    setConfirm(null); setTyped(""); onChange();
  };

  return (
    <div>
      <div className={s.toolbar}>
        <input className={s.search} placeholder="Search name, email, School ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={s.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
          <option value="All">All roles</option>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <span className={s.meta}>{shown.length} of {accounts.length}</span>
      </div>

      <div className={s.tableWrap}>
        <table className={s.table} data-plain>
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Sign-in</th><th>Records</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={6} className={s.empty}>No accounts match.</td></tr>}
            {shown.map((a) => {
              const isMe = a.user_id === me;
              const active = (a.status || "active") === "active";
              return (
                <tr key={a.user_id}>
                  <td>
                    <span className={s.who}>{fullName(a)}{isMe && <span className={s.you}>You</span>}</span>
                    <span className={s.sub}>{[a.email, a.school_id && `ID ${a.school_id}`, a.course].filter(Boolean).join(" · ") || "—"}</span>
                  </td>
                  <td>
                    <select className={s.select} value={a.role} disabled={isMe} aria-label={`Role for ${fullName(a)}`}
                      onChange={(e) => e.target.value !== a.role && setConfirm({ kind: "role", account: a, role: e.target.value })}>
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td><span className={`${s.pill} ${active ? s.pillOk : s.pillIdle}`}>{active ? "Active" : "Deactivated"}</span></td>
                  <td>{a.has_login ? "Has login" : <span className={s.pill + " " + s.pillWarn}>No login (imported)</span>}</td>
                  <td>{a.grantee_count + a.application_count > 0 ? `${a.grantee_count} grantee · ${a.application_count} applications` : "—"}</td>
                  <td className={s.actions}>
                    {!isMe && <Button size="sm" variant="secondary" onClick={() => toggleStatus(a)}>{active ? "Deactivate" : "Reactivate"}</Button>}
                    {!isMe && <Button size="sm" variant="danger" onClick={() => { setConfirm({ kind: "delete", account: a }); setTyped(""); }}>Delete</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={confirm?.kind === "role"} onClose={() => setConfirm(null)} title="Change role" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button loading={busy} onClick={changeRole}>{confirm?.account?.role === "Student" && confirm?.role !== "Student" ? "Change role and wipe student data" : "Change role"}</Button></>}>
        {confirm?.kind === "role" && (
          <p className={s.modalText}>
            Make <strong>{fullName(confirm.account)}</strong> a <strong>{confirm.role}</strong>?
            {confirm.role !== "Student" && " They will get access to the coordinator or cashier pages the next time they sign in."}
            {confirm.account.role === "Coordinator" && " They will lose coordinator access."}
            {confirm.account.role === "Student" && confirm.role !== "Student" && (
              <span className={s.warnBox}>
                <strong>This wipes their student data:</strong> profile, applications, grantee records, concerns and notifications. It's blocked if a
                payout has already been released to them. A backup file downloads first.
              </span>
            )}
          </p>
        )}
      </Modal>

      <Modal open={confirm?.kind === "delete"} onClose={() => setConfirm(null)} title="Delete account" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={confirm && norm(typed) !== norm(fullName(confirm.account))} onClick={deleteAccount}>Delete permanently</Button></>}>
        {confirm?.kind === "delete" && (
          <div>
            <p className={s.modalText}>
              This permanently deletes <strong>{fullName(confirm.account)}</strong>'s profile and sign-in. It only works for accounts with no grantee or
              application records; for anyone else, use Deactivate. A backup file downloads first.
            </p>
            <label className={s.confirmLabel}>Type <strong>{fullName(confirm.account)}</strong> to confirm
              <input className={s.search} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ───────────────────────────── Match & bind
function MatchTab({ imported, accounts, toast, onChange }) {
  const [qi, setQi] = useState("");
  const [qa, setQa] = useState("");
  const [pickI, setPickI] = useState(null);
  const [pickA, setPickA] = useState(null);
  const [schoolId, setSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const logins = useMemo(() => accounts.filter((a) => a.has_login && a.role === "Student" && a.student_id), [accounts]);

  const suggestions = useMemo(() => {
    const byName = new Map();
    logins.forEach((a) => byName.set(nameKey(a), [...(byName.get(nameKey(a)) || []), a]));
    return imported.flatMap((i) => (byName.get(nameKey(i)) || []).map((a) => ({ i, a })));
  }, [imported, logins]);

  const listI = imported.filter((i) => !norm(qi) || [fullName(i), i.school_id, i.scholarships].some((v) => norm(v).includes(norm(qi))));
  const listA = logins.filter((a) => !norm(qa) || [fullName(a), a.email, a.school_id].some((v) => norm(v).includes(norm(qa))));

  const start = (i, a) => { setPickI(i); setPickA(a); setSchoolId(a.school_id || i.school_id || ""); setConfirming(true); };

  const link = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("link_students", {
      p_imported_student_id: pickI.student_id, p_account_student_id: pickA.student_id, p_school_id: schoolId.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data?.ok) {
      return toast.error({ already_claimed: "That imported record already belongs to an account.", target_has_no_login: "That account has no login.", not_found: "One of the records no longer exists." }[data?.reason] || "Couldn't link them.");
    }
    notifyStudent(supabase, data.student_user_id, "Scholarship records linked",
      "The scholarship office matched your account to your past scholarship records. They now show on your account.");
    toast.success(`Linked. ${fullName(pickI)}'s records are now on ${fullName(pickA)}'s account.`);
    setConfirming(false); setPickI(null); setPickA(null); onChange();
  };

  return (
    <div>
      <p className={s.help}>
        Imported people have no sign-in. When one of them creates an account, bind the two here so the scholarship shows up for the student.
        Everything on the imported record moves to the account; the empty imported record is removed.
      </p>

      {suggestions.length > 0 && (
        <section className={s.card}>
          <h3 className={s.cardTitle}>Suggested matches <span className={s.count}>{suggestions.length}</span></h3>
          <p className={s.cardHint}>Same first and last name. Check the School ID or program before you confirm.</p>
          {suggestions.map(({ i, a }) => (
            <div key={`${i.student_id}-${a.student_id}`} className={s.suggest}>
              <div className={s.suggestText}>
                <strong>{fullName(i)}</strong>
                <span className={s.sub}>Imported · {[i.school_id && `ID ${i.school_id}`, i.course, i.scholarships].filter(Boolean).join(" · ") || "no details"}</span>
              </div>
              <span className={s.arrow} aria-hidden="true">→</span>
              <div className={s.suggestText}>
                <strong>{a.email || fullName(a)}</strong>
                <span className={s.sub}>Account · {[a.school_id && `ID ${a.school_id}`, a.course].filter(Boolean).join(" · ") || "profile not filled in"}</span>
              </div>
              <Button size="sm" onClick={() => start(i, a)}>Review &amp; link</Button>
            </div>
          ))}
        </section>
      )}

      <div className={s.twoCol}>
        <section className={s.card}>
          <h3 className={s.cardTitle}>Imported records <span className={s.count}>{imported.length}</span></h3>
          <input className={s.search} placeholder="Search…" value={qi} onChange={(e) => setQi(e.target.value)} />
          <div className={s.pickList}>
            {listI.length === 0 && <div className={s.empty}>Nothing to match.</div>}
            {listI.slice(0, 200).map((i) => (
              <button key={i.student_id} type="button" className={`${s.pick} ${pickI?.student_id === i.student_id ? s.pickOn : ""}`} onClick={() => setPickI(i)}>
                <strong>{fullName(i)}</strong>
                <span className={s.sub}>{[i.school_id ? `ID ${i.school_id}` : "no School ID", i.scholarships].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        </section>
        <section className={s.card}>
          <h3 className={s.cardTitle}>Student accounts <span className={s.count}>{logins.length}</span></h3>
          <input className={s.search} placeholder="Search…" value={qa} onChange={(e) => setQa(e.target.value)} />
          <div className={s.pickList}>
            {listA.length === 0 && <div className={s.empty}>No accounts.</div>}
            {listA.slice(0, 200).map((a) => (
              <button key={a.student_id} type="button" className={`${s.pick} ${pickA?.student_id === a.student_id ? s.pickOn : ""}`} onClick={() => setPickA(a)}>
                <strong>{fullName(a)}</strong>
                <span className={s.sub}>{[a.email, a.school_id && `ID ${a.school_id}`].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={s.bindBar}>
        <span>{pickI && pickA ? <>Link <strong>{fullName(pickI)}</strong> (imported) to <strong>{fullName(pickA)}</strong> (account)</> : "Pick one imported record and one account to link them."}</span>
        <Button disabled={!pickI || !pickA} onClick={() => start(pickI, pickA)}>Link them</Button>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Link these records" size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button><Button loading={busy} onClick={link}>Link records</Button></>}>
        {pickI && pickA && (
          <div>
            <p className={s.modalText}>
              All grantee records on <strong>{fullName(pickI)}</strong> (imported{pickI.scholarships ? `: ${pickI.scholarships}` : ""}) move to the account{" "}
              <strong>{pickA.email || fullName(pickA)}</strong>. Records for the same scholarship and term are combined instead of duplicated. This can't be undone.
            </p>
            <label className={s.confirmLabel}>School ID for the account
              <input className={s.search} value={schoolId} onChange={(e) => setSchoolId(e.target.value)} placeholder="Leave as is" />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ───────────────────────────── Duplicates
function DuplicatesTab({ dups, toast, onChange }) {
  const groups = useMemo(() => {
    const m = new Map();
    dups.forEach((d) => m.set(d.group_key, [...(m.get(d.group_key) || []), d]));
    return [...m.values()];
  }, [dups]);
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState(null);

  const merge = async (group, keepId) => {
    const remove = group.filter((g) => g.student_id !== keepId);
    if (remove.some((r) => r.has_login)) return toast.error("Only records without a sign-in can be merged away. Keep the one with the sign-in.");
    setBusy(group[0].group_key);
    downloadJson(`backup-duplicates-${stamp()}.json`, group);
    for (const r of remove) {
      const { data, error } = await supabase.rpc("merge_duplicate", { p_keep: keepId, p_remove: r.student_id });
      if (error || !data?.ok) { setBusy(null); return toast.error(error?.message || "Couldn't merge these."); }
    }
    setBusy(null);
    toast.success("Merged. A backup file was saved to your downloads.");
    onChange();
  };

  if (groups.length === 0) return <div className={s.empty}>No duplicates found. Two records count as duplicates when the first and last name are the same.</div>;
  return (
    <div>
      <p className={s.help}>The same name appears more than once. Choose the record to keep; the others are merged into it (their grantee records move over). Two real people with the same name are not duplicates, so check before you merge.</p>
      {groups.map((g) => {
        const chosen = keep[g[0].group_key] ?? (g.find((x) => x.has_login) || g[0]).student_id;
        return (
          <section key={g[0].group_key} className={s.card}>
            <h3 className={s.cardTitle}>{fullName(g[0])} <span className={s.count}>{g.length}</span></h3>
            {g.map((r) => (
              <label key={r.student_id} className={s.dupRow}>
                <input type="radio" name={g[0].group_key} checked={chosen === r.student_id} onChange={() => setKeep((k) => ({ ...k, [g[0].group_key]: r.student_id }))} />
                <span className={s.suggestText}>
                  <strong>{r.school_id ? `ID ${r.school_id}` : "No School ID"}</strong>
                  <span className={s.sub}>{r.has_login ? "Has sign-in" : "Imported, no sign-in"} · {r.grantee_count} grantee record{r.grantee_count === 1 ? "" : "s"}{r.scholarships ? ` · ${r.scholarships}` : ""}</span>
                </span>
                {chosen === r.student_id && <span className={`${s.pill} ${s.pillOk}`}>Keep</span>}
              </label>
            ))}
            <div className={s.cardActions}>
              <Button size="sm" loading={busy === g[0].group_key} onClick={() => merge(g, chosen)}>
                Merge into the selected record
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ───────────────────────────── Imports (undo)
function ImportsTab({ batches, toast, onChange }) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const when = (b) => { const t = Number(String(b).replace(/\D/g, "")); return t ? new Date(t).toLocaleString() : b; };

  const undo = async () => {
    setBusy(true);
    const { data: rows } = await supabase.from("grantees").select("*").eq("import_batch", target.import_batch);
    downloadJson(`backup-import-${target.import_batch}.json`, rows || []);
    const { data, error } = await supabase.rpc("undo_import_batch", { p_batch: target.import_batch });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data?.ok) return toast.error(data?.reason === "in_use" ? "Some of these grantees have already been used (for example a payout), so the import can't be undone." : "Couldn't undo this import.");
    toast.success(`Import undone: ${data.grantees} grantees and ${data.people} people removed. A backup was saved to your downloads.`);
    setTarget(null); onChange();
  };

  if (batches.length === 0) return <div className={s.empty}>No imports to show. Imports made from now on can be undone here.</div>;
  return (
    <div>
      <p className={s.help}>Each import from a file is one batch. Undoing it removes the grantees it added, and the people it created who have nothing else. It's blocked if any of them already has a payout.</p>
      <div className={s.tableWrap}>
        <table className={s.table} data-plain>
          <thead><tr><th>Imported</th><th>Grantees</th><th>New people</th><th>With payouts</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.import_batch}>
                <td>{when(b.import_batch)}</td><td>{b.grantees}</td><td>{b.people_created}</td>
                <td>{b.with_payouts > 0 ? <span className={`${s.pill} ${s.pillWarn}`}>{b.with_payouts}</span> : "0"}</td>
                <td className={s.actions}><Button size="sm" variant="danger" disabled={b.with_payouts > 0} onClick={() => setTarget(b)}>Undo</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Undo this import" size="sm"
        footer={<><Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={undo}>Undo import</Button></>}>
        {target && <p className={s.modalText}>This removes {target.grantees} grantee record{target.grantees === 1 ? "" : "s"} and up to {target.people_created} imported people from the import on {when(target.import_batch)}. A backup file downloads first.</p>}
      </Modal>
    </div>
  );
}

// ───────────────────────────── Activity
function ActivityTab({ audit }) {
  if (audit.length === 0) return <div className={s.empty}>Nothing has been recorded yet. Role changes, deletions, links, merges, imports and undos show up here.</div>;
  return (
    <div className={s.tableWrap}>
      <table className={s.table} data-plain>
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
        <tbody>
          {audit.map((a) => (
            <tr key={a.audit_id}>
              <td>{new Date(a.created_at).toLocaleString()}</td>
              <td>{a.actor || "—"}</td>
              <td><strong>{ACTION_LABELS[a.action] || a.action}</strong></td>
              <td>{describe(a) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
