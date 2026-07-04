import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AcademicSettingsCard() {
  const [settings, setSettings] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase
      .from("academic_settings")
      .select("*")
      .single();

    setSettings(data);
  }

  async function updateSettings() {
    await supabase
      .from("academic_settings")
      .update({
        academic_year: settings.academic_year,
        semester: settings.semester,
        updated_at: new Date(),
      })
      .eq("id", settings.id);

    setEditing(false);
    fetchSettings();
  }

  if (!settings) return <p>Loading...</p>;

  return (
    <div className="p-4 border rounded">
      <h2 className="font-bold">Current Academic Period</h2>

      {editing ? (
        <>
          <input
            value={settings.academic_year}
            onChange={(e) =>
              setSettings({ ...settings, academic_year: e.target.value })
            }
            className="border p-1 mt-2"
          />

          <select
            value={settings.semester}
            onChange={(e) =>
              setSettings({ ...settings, semester: e.target.value })
            }
            className="border p-1 mt-2"
          >
            <option>1st Semester</option>
            <option>2nd Semester</option>
          </select>

          <button onClick={updateSettings} className="mt-2 bg-blue-500 text-white px-3">
            Save
          </button>
        </>
      ) : (
        <>
          <p>AY: {settings.academic_year}</p>
          <p>Semester: {settings.semester}</p>

          <button onClick={() => setEditing(true)} className="mt-2 bg-gray-500 text-white px-3">
            Edit
          </button>
        </>
      )}
    </div>
  );
}