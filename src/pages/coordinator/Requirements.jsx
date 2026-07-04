import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Requirements() {
  const [appReq, setAppReq] = useState([]);
  const [eligReq, setEligReq] = useState([]);

  const [appName, setAppName] = useState("");
  const [eligName, setEligName] = useState("");

  const [appType, setAppType] = useState("Document");
  const [eligType, setEligType] = useState("Other");

  const [appDesc, setAppDesc] = useState("");
  const [eligDesc, setEligDesc] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: app } = await supabase
      .from("application_requirements")
      .select("*");

    const { data: elig } = await supabase
      .from("eligibility_requirements")
      .select("*");

    setAppReq(app || []);
    setEligReq(elig || []);
  };

  const addApp = async () => {
    if (!appName.trim()) return;

    const { error } = await supabase
  .from("application_requirements")
  .insert({
    requirement_name: appName,
    requirement_type: appType,
    description: appDesc || null,
  });

if (error) {
  console.log(error);
  alert(error.message);
  return;
}

    setAppName("");
    setAppDesc("");
    load();
  };

  const addElig = async () => {
    if (!eligName.trim()) return;

    const { error } = await supabase
  .from("eligibility_requirements")
  .insert({
    requirement_name: eligName,
    requirement_type: eligType,
    description: eligDesc || null,
  });

if (error) {
  console.log(error);
  alert(error.message);
  return;
}

    setEligName("");
    setEligDesc("");
    load();
  };

  

  return (
    <div style={page}>
    <div style={header}>
  <div>
    <h1 style={title}>Requirement Library</h1>
    <p style={subtitle}>
      Manage application and eligibility requirements used across scholarships.
    </p>
  </div>
</div>

      <div style={grid}>
        {/* APPLICATION */}
        <div style={card}>
          <h2 style={h2}> Application Requirements</h2>

          <input
            style={input}
            value={appName}
            placeholder="Requirement name *"
            onChange={(e) => setAppName(e.target.value)}
          />

          <div style={row}>
            <button
    type="button"
    onClick={()=>setAppType("Document")}
    style={{
        padding:"8px 14px",
        borderRadius:999,
        border:
            appType==="Document"
            ? "2px solid #475c6c"
            : "1px solid #ddd",

        background:
            appType==="Document"
            ? "#475c6c"
            : "#fff",

        color:
            appType==="Document"
            ? "#fff"
            : "#475c6c",

        cursor:"pointer",
        fontWeight:600,
    }}
>
Document
</button>

            <button
    type="button"
    onClick={()=>setAppType("Grade")}
    style={{
        padding:"8px 14px",
        borderRadius:999,
        border:
            appType==="Grade"
            ? "2px solid #475c6c"
            : "1px solid #ddd",

        background:
            appType==="Grade"
            ? "#475c6c"
            : "#fff",

        color:
            appType==="Grade"
            ? "#fff"
            : "#475c6c",

        cursor:"pointer",
        fontWeight:600,
    }}
>
Grade
</button>

            <button
    type="button"
    onClick={()=>setAppType("Income")}
    style={{
        padding:"8px 14px",
        borderRadius:999,
        border:
            appType==="Income"
            ? "2px solid #475c6c"
            : "1px solid #ddd",

        background:
            appType==="Income"
            ? "#475c6c"
            : "#fff",

        color:
            appType==="Income"
            ? "#fff"
            : "#475c6c",

        cursor:"pointer",
        fontWeight:600,
    }}
>
Income
</button>

            <button
    type="button"
    onClick={()=>setAppType("Other")}
    style={{
        padding:"8px 14px",
        borderRadius:999,
        border:
            appType==="Other"
            ? "2px solid #475c6c"
            : "1px solid #ddd",

        background:
            appType==="Other"
            ? "#475c6c"
            : "#fff",

        color:
            appType==="Other"
            ? "#fff"
            : "#475c6c",

        cursor:"pointer",
        fontWeight:600,
    }}
>
Other
</button>
          </div>

          <textarea
            style={textarea}
            value={appDesc}
            placeholder="Description (optional)"
            onChange={(e) => setAppDesc(e.target.value)}
          />

          <button style={button} onClick={addApp}>
            Add Requirement
          </button>
          <hr
    style={{
        border:"none",
        borderTop:"1px solid #ececec",
        margin:"8px 0 4px",
    }}
/>

<h3
    style={{
        margin:0,
        color:"#475c6c",
    }}
>
Saved Requirements
</h3>

          <div style={requirementList}>
  {[...appReq]
              .sort((a, b) =>
                a.requirement_name.localeCompare(b.requirement_name)
              )
               .map((r) => (
                <div
    key={r.application_requirement_id}
    style={requirementCard}
>

    <div
        style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
        }}
    >
        <b>{r.requirement_name}</b>

        <span style={badge}>
            {r.requirement_type}
        </span>
    </div>

    {r.description && (
        <p
            style={{
                marginTop:8,
                color:"#8a8583",
                fontSize:13,
                lineHeight:1.5,
            }}
        >
            {r.description}
        </p>
    )}

</div>
            ))}
         </div>
        </div>

        {/* ELIGIBILITY */}
        <div style={card}>
          <h2 style={h2}> Eligibility Requirements</h2>
          
          <input
            style={input}
            value={eligName}
            placeholder="Requirement name *"
            onChange={(e) => setEligName(e.target.value)}
          />

          <div style={row}>
            <button
    type="button"
    onClick={()=> setEligType("Status")}
    style={{
        padding:"8px 14px",
        borderRadius:999,
        border:
            eligType==="Status"
            ? "2px solid #475c6c"
            : "1px solid #ddd",

        background:
            eligType==="Status"
            ? "#475c6c"
            : "#fff",

        color:
            eligType==="Status"
            ? "#fff"
            : "#475c6c",

        cursor:"pointer",
        fontWeight:600,
    }}
>
Status
</button>

            <button
    type="button"
    onClick={()=> setEligType("Other")}
    style={{
        padding:"8px 14px",
        borderRadius:999,
        border:
            eligType==="Other"
            ? "2px solid #475c6c"
            : "1px solid #ddd",

        background:
            eligType==="Other"
            ? "#475c6c"
            : "#fff",

        color:
            eligType==="Other"
            ? "#fff"
            : "#475c6c",

        cursor:"pointer",
        fontWeight:600,
    }}
>
Other
</button>
          </div>

          <textarea
            style={textarea}
            value={eligDesc}
            placeholder="Description (optional)"
            onChange={(e) => setEligDesc(e.target.value)}
          />

          <button style={button} onClick={addElig}>
            Add Requirement
          </button>
          <hr
    style={{
        border:"none",
        borderTop:"1px solid #ececec",
        margin:"8px 0 4px",
    }}
/>

<h3
    style={{
        margin:0,
        color:"#475c6c",
    }}
>
Saved Requirements
</h3>

          <div style={requirementList}>
  {[...eligReq]
              .sort((a, b) =>
                a.requirement_name.localeCompare(b.requirement_name)
              )
               .map((r) => (
                <div
    key={r.eligibility_requirement_id}
    style={requirementCard}
>

    <div
        style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
        }}
    >
        <b>{r.requirement_name}</b>

        <span style={badge}>
            {r.requirement_type}
        </span>
    </div>

    {r.description && (
        <p
            style={{
                marginTop:8,
                color:"#8a8583",
                fontSize:13,
                lineHeight:1.5,
            }}
        >
            {r.description}
        </p>
    )}

</div>
            ))}
         </div>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const page = {
  padding: "20px",
  background: "#f4f6f8",
  minHeight: "100vh",
  fontFamily: "Inter, Arial, sans-serif",
  color: "#111827",
};

const title = {
  fontSize: "22px",
  fontWeight: "700",
  marginBottom: "20px",
  color: "#1f1f1f",
};

const h2 = {
  fontSize: "16px",
  marginBottom: "10px",
  color: "#1f1f1f",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
"repeat(auto-fit,minmax(420px,1fr))",
  gap: "20px",
  scrollbarWidth: "none",
};

const card = {
  background:"#fff",
  borderRadius:18,
  padding:24,
  boxShadow:"0 10px 25px rgba(0,0,0,.06)",
  display:"flex",
  flexDirection:"column",
  gap:18,
  minHeight:720,
};

const input = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d9d9d9",
  borderRadius: 8,
  background: "#fff",
  color: "#475c6c",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const textarea = {
  ...input,
  minHeight: 90,
  resize: "vertical",
};

const row = {
  display: "flex",
  gap: "15px",
  marginBottom: "10px",
  flexWrap: "wrap",
};

const label = {
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
};

const button = {
  padding:"12px",
  border:"none",
  borderRadius:10,
  background:"#475c6c",
  color:"#fff",
  fontWeight:600,
  cursor:"pointer",
  transition:"all .2s",
  marginBottom:10,
};

const requirementCard = {
  padding: 16,
  border: "1px solid #ececec",
  borderRadius: 10,
  background: "#fafafa",
  marginBottom: 10,
};
const badge = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "#eed7a1",
  color: "#475c6c",
  fontWeight: 600,
  fontSize: 12,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const subtitle = {
  marginTop: 6,
  color: "#8a8583",
  fontSize: 14,
};

const requirementList = {
  marginTop: 10,
  maxHeight: 420,
  overflowY: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

requirementList["&::-webkit-scrollbar"] = {
  display: "none",
};