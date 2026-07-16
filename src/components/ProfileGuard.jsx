import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import { getMissingProfileFields } from "@/lib/profileCompleteness";
import PageLoader from "@/components/ui/PageLoader";

export default function ProfileGuard({ children }) {
  const { loading: sessionLoading, profile } = useSession();
  const [checking, setChecking] = useState(true);
  const [missingFields, setMissingFields] = useState(null); // null = still checking

  useEffect(() => {
    if (sessionLoading) return;

    if (!profile) {
      setChecking(false);
      return;
    }

    let active = true;

    const checkStudentRecord = async () => {
      const { data: student } = await supabase
        .from("students")
        .select("school_id, course, year_level, ethnicity, gender, contact_number")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      if (!active) return;

      setMissingFields(getMissingProfileFields(profile, student));
      setChecking(false);
    };

    checkStudentRecord();
    return () => { active = false; };
  }, [sessionLoading, profile]);

  if (sessionLoading || checking) {
    return <PageLoader label="Checking your profile…" />;
  }

  if (missingFields && missingFields.length > 0) {
    return (
      <Navigate
        to="/student/profile"
        replace
        state={{ profileIncomplete: true, missingFields: missingFields.map(f => f.label) }}
      />
    );
  }

  return children;
}
