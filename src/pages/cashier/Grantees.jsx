import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Grantees() {
  const [data, setData] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("grantees").select(`
      grantee_id,
      status,
      date_awarded,
      students (
        student_id,
        school_id,
        course
      ),
      scholarships (
        scholarship_name,
        amount
      )
    `);

    setData(data);
  };

  return (
    <div>
      <h1>Grantees</h1>

      {data?.map((g) => (
        <div key={g.grantee_id} style={card}>
          <p>Student ID: {g.students?.school_id}</p>
          <p>Course: {g.students?.course}</p>
          <p>Scholarship: {g.scholarships?.scholarship_name}</p>
          <p>Status: {g.status}</p>
          <p>Amount: ₱{g.scholarships?.amount}</p>
        </div>
      ))}
    </div>
  );
}

const card = {
  background: "white",
  padding: 15,
  margin: 10,
  borderRadius: 8,
};