import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import PageLoader from "@/components/ui/PageLoader";

export default function ProfileGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      const { data } = await supabase.auth.getUser();

      const user = data?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      // USERS TABLE
      const { data: userRow } = await supabase
        .from("users")
        .select(`
          user_id,
          first_name,
          middle_name,
          last_name
        `)
        .eq("auth_id", user.id)
        .single();

      // STUDENTS TABLE
      const { data: student } = await supabase
        .from("students")
        .select(`
          school_id,
          course,
          year_level,
          ethnicity,
          gender,
          contact_number
        `)
        .eq("user_id", userRow.user_id)
        .maybeSingle();

      const isComplete =
        userRow?.first_name &&
        userRow?.middle_name &&
        userRow?.last_name &&
        student?.school_id &&
        student?.course &&
        student?.year_level &&
        student?.ethnicity &&
        student?.gender &&
        student?.contact_number;

      setComplete(!!isComplete);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  if (loading) {
    return <PageLoader label="Checking your profile…" />;
  }

  if (!complete) {
    return <Navigate to="/student/profile" replace />;
  }

  return children;
}