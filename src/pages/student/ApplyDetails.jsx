import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ApplyDetails() {
  const { id } = useParams();
  const [scholarship, setScholarship] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("scholarships")
      .select("*")
      .eq("scholarship_id", id)
      .single();

    setScholarship(data);
  };

  const apply = async () => {
    const user = await supabase.auth.getUser();

    await supabase.from("scholarship_applications").insert({
      student_id: 1, // replace with real mapping later
      scholarship_id: id,
      status: "Pending",
    });

    alert("Application Submitted!");
  };

  return (
    <div>
      <h1>Apply</h1>

      {scholarship && (
        <>
          <h2>{scholarship.scholarship_name}</h2>
          <p>{scholarship.description}</p>

          <button onClick={apply}>Submit Application</button>
        </>
      )}
    </div>
  );
}