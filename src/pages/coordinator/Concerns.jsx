import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import { useToast } from "@/context/ToastContext";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import StatCard from "@/components/ui/StatCard";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { getCached, setCached } from "@/lib/dataCache";
import s from "./Concerns.module.css";

const CACHE_KEY = "coordinator-concerns";
const PAGE_SIZE = 10;

const STATUS_BADGE = { Open: "badgeWarning", "In Progress": "badgeInfo", Resolved: "badgeSuccess" };

export default function Concerns() {
  const { profile } = useSession();
  const toast = useToast();
  const cached = getCached(CACHE_KEY);
  const [rows, setRows] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState(null);
  const [response, setResponse] = useState("");
  const [nextStatus, setNextStatus] = useState("In Progress");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!getCached(CACHE_KEY)) setLoading(true);

    const { data, error } = await supabase
      .from("student_concerns")
      .select(`
        *,
        students(
          student_id, school_id,
          users(first_name, last_name)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load concerns: " + error.message);
      setRows([]);
    } else {
      setRows(data || []);
      setCached(CACHE_KEY, data || []);
    }
    setLoading(false);
  };

  const openConcern = (c) => {
    setSelected(c);
    setResponse(c.coordinator_response || "");
    setNextStatus(c.status === "Open" ? "In Progress" : c.status);
  };

  const submitResponse = async () => {
    if (!selected) return;
    if (!response.trim()) {
      toast.error("Write a response before sending.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("student_concerns")
      .update({
        coordinator_response: response.trim(),
        status: nextStatus,
        responded_by: profile?.user_id || null,
        responded_at: new Date().toISOString(),
      })
      .eq("concern_id", selected.concern_id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Let the student know a reply is waiting — same notifications table
    // the announcement feature and everything else already use.
    if (selected.students?.student_id) {
      const { data: studentUser } = await supabase
        .from("students")
        .select("user_id")
        .eq("student_id", selected.students.student_id)
        .single();

      if (studentUser?.user_id) {
        await supabase.from("notifications").insert({
          user_id: studentUser.user_id,
          title: `Update on "${selected.subject}"`,
          message: response.trim(),
          notification_type: "Concern",
          is_read: false,
        });
      }
    }

    setSaving(false);
    setSelected(null);
    toast.success("Response sent.");
    load();
  };

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      const fullname = `${c.students?.users?.first_name || ""} ${c.students?.users?.last_name || ""}`.toLowerCase();
      const keyword = search.toLowerCase();
      const matchesSearch =
        c.subject?.toLowerCase().includes(keyword) ||
        c.message?.toLowerCase().includes(keyword) ||
        fullname.includes(keyword) ||
        c.students?.school_id?.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || c.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [rows, search, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCount = rows.filter(c => c.status === "Open").length;
  const inProgressCount = rows.filter(c => c.status === "In Progress").length;
  const resolvedCount = rows.filter(c => c.status === "Resolved").length;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1>Concerns</h1>
          <p>Problems and concerns students have sent in, with your replies.</p>
        </div>
      </div>

      <div className={s.summaryGrid}>
        <StatCard label="Open" value={openCount} tone="warning" explain="Concerns not yet responded to." />
        <StatCard label="In Progress" value={inProgressCount} tone="info" explain="Concerns you've replied to but marked as still ongoing." />
        <StatCard label="Resolved" value={resolvedCount} tone="success" explain="Concerns marked Resolved." />
        <StatCard label="Total" value={rows.length} explain="All concerns ever submitted." />
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by student, school ID, or subject…"
        resultCount={filtered.length}
        totalCount={rows.length}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { value: "All", label: "All Status" },
              { value: "Open", label: "Open" },
              { value: "In Progress", label: "In Progress" },
              { value: "Resolved", label: "Resolved" },
            ],
          },
          {
            label: "Category",
            value: categoryFilter,
            onChange: (v) => { setCategoryFilter(v); setPage(1); },
            options: [
              { value: "All", label: "All Categories" },
              { value: "Application", label: "Application" },
              { value: "Compliance", label: "Compliance" },
              { value: "Financial", label: "Financial" },
              { value: "Technical", label: "Technical" },
              { value: "Other", label: "Other" },
            ],
          },
        ]}
      />

      <div className={s.tableContainer}>
        <table className={s.table}>
          <thead className={s.thead}>
            <tr>
              <th className={s.th}>Student</th>
              <th className={s.th}>School ID</th>
              <th className={s.th}>Subject</th>
              <th className={s.th}>Category</th>
              <th className={s.th}>Submitted</th>
              <th className={s.th}>Status</th>
              <th className={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: "14px 16px" }}><TableSkeleton columns={7} rows={6} /></td></tr>
            ) : currentRows.length === 0 ? (
              <tr><td colSpan={7} className={s.emptyState}>No concerns found.</td></tr>
            ) : currentRows.map((c) => (
              <tr key={c.concern_id}>
                <td className={s.td}>{c.students?.users?.first_name} {c.students?.users?.last_name}</td>
                <td className={s.td}>{c.students?.school_id || "—"}</td>
                <td className={s.td}>{c.subject}</td>
                <td className={s.td}>{c.category}</td>
                <td className={s.td}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td className={s.td}>
                  <span className={s[STATUS_BADGE[c.status]] || s.badgeNeutral}>{c.status}</span>
                </td>
                <td className={s.td}>
                  <button className={s.viewBtn} onClick={() => openConcern(c)}>
                    {c.status === "Open" ? "Respond" : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={s.pagination}>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      {/* ================= RESPOND MODAL ================= */}
      {selected && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className={s.modalLarge}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>{selected.subject}</h2>
                <p className={s.modalSubtitle}>
                  {selected.students?.users?.first_name} {selected.students?.users?.last_name}
                  {" "}· {selected.students?.school_id || "—"} · {selected.category}
                  {" "}· {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
              <button className={s.closeBtn} onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className={s.modalBody}>
              <div className={s.bubble}>
                <strong className={s.bubbleLabel}>Student</strong>
                <p>{selected.message}</p>
              </div>

              {selected.coordinator_response && (
                <div className={`${s.bubble} ${s.bubbleReply}`}>
                  <strong className={s.bubbleLabel}>Your previous reply</strong>
                  <p>{selected.coordinator_response}</p>
                  {selected.responded_at && (
                    <span className={s.date}>{new Date(selected.responded_at).toLocaleString()}</span>
                  )}
                </div>
              )}

              <div className={s.field}>
                <label>{selected.coordinator_response ? "Update your response" : "Your response"}</label>
                <textarea
                  className={s.textarea}
                  rows={5}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Write your reply — the student sees this immediately, and gets a notification."
                />
              </div>

              <div className={s.field}>
                <label>Mark as</label>
                <select className={s.selectInput} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={() => setSelected(null)}>Cancel</button>
              <button className={s.btnPrimary} disabled={saving} onClick={submitResponse}>
                {saving ? "Sending…" : "Send response"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
