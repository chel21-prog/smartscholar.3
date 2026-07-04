import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import PageLoader from "@/components/ui/PageLoader";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      // Wait for Supabase to restore the session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/Login");
        return;
      }

      const authUser = session.user;

      // Find the user's role
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("user_id, role")
        .eq("auth_id", authUser.id)
        .single();

      if (profileError || !profile) {
        navigate("/Login");
        return;
      }

      // ==========================
      // STUDENT
      // ==========================
      if (profile.role === "Student") {
        const { data: userData } = await supabase
          .from("users")
          .select(`
            user_id,
            first_name,
            middle_name,
            last_name
          `)
          .eq("auth_id", authUser.id)
          .single();

        const { data: studentData } = await supabase
          .from("students")
          .select(`
            school_id,
            course,
            year_level,
            gender,
            ethnicity,
            contact_number
          `)
          .eq("user_id", userData.user_id)
          .single();

        const profileComplete =
          userData?.first_name &&
          userData?.middle_name &&
          userData?.last_name &&
          studentData?.school_id &&
          studentData?.course &&
          studentData?.year_level &&
          studentData?.gender &&
          studentData?.ethnicity &&
          studentData?.contact_number;

        if (profileComplete) {
          navigate("/student/dashboard");
        } else {
          navigate("/student/profile");
        }

        return;
      }

      // ==========================
      // COORDINATOR
      // ==========================
      if (profile.role === "Coordinator") {
        navigate("/coordinator/dashboard");
        return;
      }

      // ==========================
      // CASHIER
      // ==========================
      if (profile.role === "Cashier") {
        navigate("/cashier/dashboard");
        return;
      }

      navigate("/");
    };

    handleAuth();
  }, [navigate]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "var(--ink-50)",
      }}
    >
      <PageLoader label="Signing you in…" />
    </div>
  );
}