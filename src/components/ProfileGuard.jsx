import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import PageLoader from "@/components/ui/PageLoader";

export default function ProfileGuard({ children }) {
  const { loading: sessionLoading, profile } = useSession();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);

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

      const isComplete =
        profile.first_name &&
        profile.middle_name &&
        profile.last_name &&
        student?.school_id &&
        student?.course &&
        student?.year_level &&
        student?.ethnicity &&
        student?.gender &&
        student?.contact_number;

      setComplete(!!isComplete);
      setChecking(false);
    };

    checkStudentRecord();
    return () => { active = false; };
  }, [sessionLoading, profile]);

  if (sessionLoading || checking) {
    return <PageLoader label="Checking your profile…" />;
  }

  if (!complete) {
    return <Navigate to="/student/profile" replace />;
  }

  return children;
}
