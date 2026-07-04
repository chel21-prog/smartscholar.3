import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function Settings() {
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);

    await supabase.auth.signOut();

    // redirect to login page
    window.location.href = "/";
  };

  return (
    <div>
      <h1>Settings</h1>

      <div style={card}>
        <h3>Account</h3>

        <button onClick={logout} disabled={loading}>
          {loading ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 10,
  maxWidth: 300,
};