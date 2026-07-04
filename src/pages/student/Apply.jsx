import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Apply() {
  const [data, setData] = useState([]);
  const [academic, setAcademic] = useState(null);

  useEffect(() => {
  load();
  loadAcademic();
}, []);

  const load = async () => {
    const { data } = await supabase.from("scholarships").select("*");
    setData(data);
  };

  const loadAcademic = async () => {
  const { data } = await supabase
    .from("academic_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  setAcademic(data);
};

  return (
    <div>
      <div style={{ background: "#eef2ff", padding: 15, marginBottom: 20 }}>
  <h3>Current Academic Period</h3>

  <p><b>Academic Year:</b> {academic?.academic_year}</p>
  <p><b>Semester:</b> {academic?.semester}</p>
</div>
      <h1>Apply for Scholarships</h1>
       
      {data?.map((s) => (
        <div key={s.scholarship_id} style={card}>
          <h3>{s.scholarship_name}</h3>

          <Link to={`/student/apply/${s.scholarship_id}`}>
            Apply Now
          </Link>
        </div>
      ))}
    </div>
  );
}

const card = {
  background: "white",
  padding: 15,
  margin: 10,
};