import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import styles from "./Requirements.module.css";
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
        {/* APPLICATION */}
       <div className={styles.card}>
          <h2 className={styles.heading}> Application Requirements</h2>

          <input
            className={styles.input}
            value={appName}
            placeholder="Requirement name *"
            onChange={(e) => setAppName(e.target.value)}
          />

          <div className={styles.row}>
            <button
    type="button"
    onClick={()=>setAppType("Document")}
     className={`${styles.typeBtn} ${
        appType==="Grade"
            ? styles.typeBtnActive
            : ""
    }`}
>
Grade
</button>

            <button
    type="button"
    onClick={()=>setAppType("Income")}
     className={`${styles.typeBtn} ${
        appType==="Income"
            ? styles.typeBtnActive
            : ""
    }`}
>
Income
</button>

            <button
    type="button"
    onClick={()=>setAppType("Other")}
     className={`${styles.typeBtn} ${
        appType==="Other"
            ? styles.typeBtnActive
            : ""
    }`}
>
Other
</button>
          </div>

          <textarea
            className={styles.textarea}
            value={appDesc}
            placeholder="Description (optional)"
            onChange={(e) => setAppDesc(e.target.value)}
          />

          <button className={styles.primaryBtn} onClick={addApp}>
            Add Requirement
          </button>
          <hr className={styles.divider}/>

<h3 className={styles.savedTitle}>
Saved Requirements
</h3>

          <div className={styles.requirementList}>
  {[...appReq]
              .sort((a, b) =>
                a.requirement_name.localeCompare(b.requirement_name)
              )
               .map((r) => (
                <div
    key={r.application_requirement_id}
    className={styles.requirementCard}
>

    <div className={styles.requirementHeader}>
        <b>{r.requirement_name}</b>

        <span className={styles.badge}>
            {r.requirement_type}
        </span>
    </div>

    {r.description && (
        <p className={styles.description}>
            {r.description}
        </p>
    )}

</div>
            ))}
         </div>
        </div>

        {/* ELIGIBILITY */}
        <div className={styles.card}>
          <h2 className={styles.heading}> Eligibility Requirements</h2>
          
          <input
            className={styles.input}
            value={eligName}
            placeholder="Requirement name *"
            onChange={(e) => setEligName(e.target.value)}
          />
  
          <div className={styles.row}>
            <button
    type="button"
    onClick={()=> setEligType("Status")}
     className={`${styles.typeBtn} ${
        eligType==="Status"
            ? styles.typeBtnActive
            : ""
    }`}
>
Status
</button>

            <button
    type="button"
    onClick={()=> setEligType("Other")}
     className={`${styles.typeBtn} ${
        eligType==="Other"
            ? styles.typeBtnActive
            : ""
    }`}
>
Other
</button>
          </div>

          <textarea
            className={styles.textarea}
            value={eligDesc}
            placeholder="Description (optional)"
            onChange={(e) => setEligDesc(e.target.value)}
          />

          <button className={styles.primaryBtn} onClick={addElig}>
            Add Requirement
          </button>
          <hr className={styles.divider}/>

<h3 className={styles.savedTitle}>
Saved Requirements
</h3>

          <div className={styles.requirementList}>
  {[...eligReq]
              .sort((a, b) =>
                a.requirement_name.localeCompare(b.requirement_name)
              )
              .map((r) => (
                <div
    key={r.eligibility_requirement_id}
    className={styles.requirementCard}
>

    <div className={styles.requirementHeader}>
        <b>{r.requirement_name}</b>

        <span className={styles.badge}>
            {r.requirement_type}
        </span>
    </div>

    {r.description && (
        <p className={styles.description}>
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