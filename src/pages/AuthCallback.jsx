import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/context/ToastContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const toast = useToast();

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

      // Find the user's role — or, if this is the first time this Google
      // account has ever signed in, there won't be a `users` row yet at
      // all. Previously that case just silently bounced back to /Login
      // with no explanation and no account ever created. Now: create one.
      let { data: profile, error: profileError } = await supabase
        .from("users")
        .select("user_id, role, first_name, middle_name, last_name")
        .eq("auth_id", authUser.id)
        .maybeSingle();

      if (profileError) {
        toast.error("Couldn't sign you in: " + profileError.message);
        navigate("/Login");
        return;
      }

      if (!profile) {
        // Pull whatever name Google gave us so the student doesn't have
        // to retype it — falls back to null (and the profile-completeness
        // reminder will catch it) if Google didn't provide one.
        const meta = authUser.user_metadata || {};
        const fullName = meta.full_name || meta.name || "";
        const firstName = meta.given_name  || fullName.split(" ")[0] || null;
        const lastName  = meta.family_name || fullName.split(" ").slice(1).join(" ") || null;

        const { data: newUser, error: createUserError } = await supabase
          .from("users")
          .insert([{
            auth_id: authUser.id,
            email: authUser.email,
            first_name: firstName,
            last_name: lastName,
            role: "Student", // self-serve Google sign-in is always a Student account,
                              // same as the email/password Signup flow — Coordinator
                              // and Cashier accounts are provisioned separately, not
                              // created on first login.
            status: "active",
          }])
          .select("user_id, role, first_name, middle_name, last_name")
          .single();

        if (createUserError) {
          toast.error("Couldn't finish creating your account: " + createUserError.message);
          navigate("/Login");
          return;
        }

        profile = newUser;
      }

      // ==========================
      // STUDENT
      // ==========================
      if (profile.role === "Student") {
        // Self-heal: if the `users` row exists but its `students` row
        // doesn't (e.g. an earlier signup attempt partially failed),
        // create it now instead of erroring on the .single() below.
        const { data: existingStudent } = await supabase
          .from("students")
          .select("school_id")
          .eq("user_id", profile.user_id)
          .maybeSingle();

        if (!existingStudent) {
          const { error: createStudentError } = await supabase.from("students").insert([{
            user_id: profile.user_id,
            course: null,
            year_level: null,
            gender: null,
            ethnicity: null,
            contact_number: null,
            school_id: null,
            status: "Enrolled",
          }]);

          if (createStudentError) {
            toast.error("Couldn't finish creating your student profile: " + createStudentError.message);
            navigate("/Login");
            return;
          }
        }

        // Always land on the dashboard after signing in/creating an
        // account — ProfileGuard (which wraps that route) independently
        // checks completeness and redirects to /student/profile with the
        // missing-fields reminder if needed, so there's no need to
        // duplicate that check here too.
        navigate("/student/dashboard");
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