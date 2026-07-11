import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AnnouncementModal from "@/components/ui/AnnouncementModal";
import PageLoader from "@/components/ui/PageLoader";

export default function CashierDashboard() {
  const [grantees,          setGrantees]          = useState([]);
  const [releases,          setReleases]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [showAnnouncement,  setShowAnnouncement]  = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: r }] = await Promise.all([
      supabase.from("grantees").select("grantee_id,status"),
      supabase.from("fund_releases").select("release_id,amount_released,status,release_date"),
    ]);
    setGrantees(g || []);
    setReleases(r || []);
    setLoading(false);
  };

  if (loading) return <PageLoader label="Loading dashboard…" />;

  const totalGrantees  = grantees.length;
  const totalReleased  = releases.filter(r => r.status === "Released").reduce((sum, r) => sum + Number(r.amount_released || 0), 0);
  const pending        = releases.filter(r => r.status === "Pending").length;
  const releasedCount  = releases.filter(r => r.status === "Released").length;
  const total          = releasedCount + pending || 1;

  const stats = [
    ["Total Grantees",       totalGrantees,                          ""],
    ["Total Released",        `₱${totalReleased.toLocaleString()}`,  "var(--success-600)"],
    ["Pending Releases",      pending,                                "var(--warning-600)"],
    ["Completed Releases",    releasedCount,                          "var(--navy-600)"],
  ];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={{margin:0}}>Cashier Dashboard</h1>
          <p style={{margin:"4px 0 0",fontSize:13,color:"var(--text-secondary)"}}>
            Overview of grantees and fund releases.
          </p>
        </div>
        <button style={s.announceBtn} onClick={() => setShowAnnouncement(true)}>
          Announcements
        </button>
      </div>

      {/* KPI cards */}
      <div style={s.grid}>
        {stats.map(([label, value, color]) => (
          <div key={label} style={s.card}>
            <div style={{fontSize:22,fontWeight:800,color:color||"var(--text-primary)",lineHeight:1}}>{value}</div>
            <div style={{marginTop:6,fontSize:11,fontWeight:600,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:".3px"}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={s.chartBox}>
        <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>Release Status Overview</h3>
        {[["Released", releasedCount, "var(--success-600)"], ["Pending", pending, "var(--warning-600)"]].map(([label, val, color]) => (
          <div key={label} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{width:80,fontSize:13,color:"var(--text-secondary)",fontWeight:600}}>{label}</div>
            <div style={{flex:1,height:10,background:"var(--border)",borderRadius:10,overflow:"hidden"}}>
              <div style={{width:`${(val/total)*100}%`,height:"100%",background:color,borderRadius:10,transition:"width .4s"}} />
            </div>
            <div style={{width:30,textAlign:"right",fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Recent releases table */}
      <div style={s.tableBox}>
        <h3 style={{margin:"0 0 14px",fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>Recent Fund Releases</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr>
                {["Date","Amount","Status"].map(h => (
                  <th key={h} style={{textAlign:"left",padding:"10px 14px",background:"var(--navy-900)",color:"#fff",fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:".3px"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {releases.slice(0, 8).map((r, i) => (
                <tr key={r.release_id} style={{background:i%2===0?"var(--surface)":"var(--surface-muted)"}}>
                  <td style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",color:"var(--text-primary)"}}>{r.release_date || "—"}</td>
                  <td style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",color:"var(--text-primary)",fontWeight:600}}>₱{Number(r.amount_released||0).toLocaleString()}</td>
                  <td style={{padding:"10px 14px",borderBottom:"1px solid var(--border)"}}>
                    <span style={{padding:"4px 12px",borderRadius:999,fontSize:11,fontWeight:700,
                      background:r.status==="Released"?"var(--success-100)":"var(--warning-100)",
                      color:r.status==="Released"?"var(--success-700)":"var(--warning-700)"}}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnnouncementModal
        open={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
      />
    </div>
  );
}

const s = {
  page:        { display:"flex",flexDirection:"column",gap:"var(--space-5)" },
  header:      { display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12 },
  announceBtn: { padding:"10px 18px",background:"var(--navy-700)",color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap" },
  grid:        { display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14 },
  card:        { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"var(--space-5)",boxShadow:"var(--shadow-sm)" },
  chartBox:    { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"var(--space-5)",boxShadow:"var(--shadow-sm)" },
  tableBox:    { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"var(--space-5)",boxShadow:"var(--shadow-sm)" },
};
