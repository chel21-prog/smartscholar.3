import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, Badge } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { TableWrap, Table } from "@/components/ui/Table";
import PageLoader from "@/components/ui/PageLoader";
import styles from "./Profile.module.css";

const STATUS_CYCLE = ["Compliant", "Non-Compliant"];

export default function Profile() {
  const [student, setStudent] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // "idle" | "saving" | "saved" - reflects real auto-save state instead
  // of a static label that used to read "Auto Saved" even before the
  // student had typed anything.
  const [saveState, setSaveState] = useState("idle");
  const saveTimeout = useRef(null);

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    school_id: "",
    course: "",
    year_level: "",
    ethnicity: "",
    gender: "",
    contact_number: "",
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const { data: userRow } = await supabase
        .from("users")
        .select(`user_id, first_name, middle_name, last_name`)
        .eq("auth_id", user.id)
        .maybeSingle();

      const { data: studentData } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", userRow.user_id)
        .maybeSingle();

      setStudent(studentData);

      if (studentData) {
        setForm({
          first_name: userRow?.first_name || "",
          middle_name: userRow?.middle_name || "",
          last_name: userRow?.last_name || "",
          school_id: studentData.school_id || "",
          course: studentData.course || "",
          year_level: studentData.year_level || "",
          ethnicity: studentData.ethnicity || "",
          gender: studentData.gender || "",
          contact_number: studentData.contact_number || "",
        });
      }

      const { data: req } = await supabase
        .from("eligibility_requirements")
        .select("*");

      const { data: profile } = await supabase
        .from("student_eligibility_profile")
        .select("*")
        .eq("student_id", studentData?.student_id);

      const merged = (req || []).map((r) => {
        const match = (profile || []).find(
          (p) => p.eligibility_requirement_id === r.eligibility_requirement_id
        );
        return { ...r, status: match?.status };
      });

      setRequirements(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibilityRequirements = async () => {
    if (!student) {
      alert("Please fill in and save your student profile first.");
      return;
    }

    setRefreshing(true);

    try {
      const { data: requirementsData, error: reqError } = await supabase
        .from("eligibility_requirements")
        .select("*");
      if (reqError) throw reqError;

      const { data: existing, error: existingError } = await supabase
        .from("student_eligibility_profile")
        .select("eligibility_requirement_id")
        .eq("student_id", student.student_id);
      if (existingError) throw existingError;

      const existingIds = new Set(
        existing.map((r) => r.eligibility_requirement_id)
      );

      const missingRequirements = requirementsData
        .filter((r) => !existingIds.has(r.eligibility_requirement_id))
        .map((r) => ({
          student_id: student.student_id,
          eligibility_requirement_id: r.eligibility_requirement_id,
          status: "Pending",
        }));

      if (missingRequirements.length > 0) {
        const { error } = await supabase
          .from("student_eligibility_profile")
          .insert(missingRequirements);
        if (error) throw error;
      }

      await load();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const autoSaveStudent = (updatedForm) => {
    clearTimeout(saveTimeout.current);
    setSaveState("saving");

    saveTimeout.current = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) return;

        const { data: userRow } = await supabase
          .from("users")
          .select("user_id")
          .eq("auth_id", user.id)
          .maybeSingle();

        if (!userRow) return;

        await supabase
          .from("users")
          .update({
            first_name: updatedForm.first_name,
            middle_name: updatedForm.middle_name,
            last_name: updatedForm.last_name,
          })
          .eq("user_id", userRow.user_id);

        const payload = {
          user_id: userRow.user_id,
          school_id: updatedForm.school_id,
          course: updatedForm.course,
          year_level: updatedForm.year_level,
          gender: updatedForm.gender,
          ethnicity: updatedForm.ethnicity,
          contact_number: updatedForm.contact_number,
        };

        if (student) {
          await supabase
            .from("students")
            .update(payload)
            .eq("student_id", student.student_id);
        } else {
          const { data: inserted } = await supabase
            .from("students")
            .insert(payload)
            .select()
            .maybeSingle();

          if (inserted) setStudent(inserted);
        }

        setSaveState("saved");
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveState("idle");
      }
    }, 500);
  };

  const updateField = (key, value) => {
    const updated = { ...form, [key]: value };
    setForm(updated);
    autoSaveStudent(updated);
  };

  // Students can mark their own compliance items here. This mirrors a
  // self-attestation checklist (track your own progress gathering
  // documents) rather than official verification - flagging here since
  // it's a product/business-logic question, not something to silently
  // change. If compliance is meant to be coordinator-verified only,
  // this control should move there instead.
  const toggleCompliance = async (reqItem) => {
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(reqItem.status) + 1) % STATUS_CYCLE.length];

    const { error } = await supabase
      .from("student_eligibility_profile")
      .upsert(
        {
          student_id: student.student_id,
          eligibility_requirement_id: reqItem.eligibility_requirement_id,
          status: next,
        },
        { onConflict: "student_id,eligibility_requirement_id" }
      );

    if (error) return alert(error.message);

    setRequirements((prev) =>
      prev.map((r) =>
        r.eligibility_requirement_id === reqItem.eligibility_requirement_id
          ? { ...r, status: next }
          : r
      )
    );
  };

  if (loading) return <PageLoader label="Loading your profile…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Student Profile</h1>
        <p className={styles.subtitle}>
          Keep your details current — scholarship eligibility is checked against this information.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Student information"
          action={
            <span className={styles.saveStatus} data-state={saveState}>
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "✓ Saved"}
              {saveState === "idle" && "Auto-saves as you type"}
            </span>
          }
        />

        <div className={styles.formGrid}>
          <Field label="First name" required>
            <Input
              value={form.first_name}
              onChange={(e) => updateField("first_name", e.target.value)}
            />
          </Field>

          <Field label="Middle name" required>
            <Input
              value={form.middle_name}
              onChange={(e) => updateField("middle_name", e.target.value)}
            />
          </Field>

          <Field label="Last name" required>
            <Input
              value={form.last_name}
              onChange={(e) => updateField("last_name", e.target.value)}
            />
          </Field>

          <Field label="School ID" required>
            <Input
              value={form.school_id}
              onChange={(e) => updateField("school_id", e.target.value)}
            />
          </Field>

          <Field label="Program" required>
            <Select
              value={form.course}
              onChange={(e) => updateField("course", e.target.value)}
            >
              <option value="">Select course</option>
              <option value="BSIT">Bachelor of Science in Information Technology</option>
              <option value="BSTM">Bachelor of Science in Tourism Management</option>
              <option value="BSHM">Bachelor of Science in Hospitality Management</option>
              <option value="BSITech">Bachelor of Science in Industrial Technology</option>
              <option value="BSA">Bachelor of Science in Agriculture</option>
              <option value="BSED">Bachelor of Science in Education</option>
            </Select>
          </Field>

          <Field label="Year level" required>
            <Select
              value={form.year_level}
              onChange={(e) => updateField("year_level", e.target.value)}
            >
              <option value="">Select year level</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </Select>
          </Field>

          <Field label="Gender" required>
            <Select
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </Select>
          </Field>

          <Field label="Ethnicity" required>
            <Input
              value={form.ethnicity}
              onChange={(e) => {
                const value = e.target.value;
                if (/^[a-zA-Z\s]*$/.test(value)) updateField("ethnicity", value);
              }}
            />
          </Field>

          <Field label="Contact number" required>
            <Input
              value={form.contact_number}
              inputMode="numeric"
              onChange={(e) => {
                const value = e.target.value;
                if (/^\d*$/.test(value)) updateField("contact_number", value);
              }}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Compliance checker"
          subtitle="Mark requirements as you gather your documents."
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={refreshing}
              onClick={fetchEligibilityRequirements}
            >
              Refresh requirements
            </Button>
          }
        />

        {requirements.length === 0 ? (
          <p className={styles.noRequirements}>
            No eligibility requirements have been published yet.
          </p>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr key={r.eligibility_requirement_id}>
                    <td className={styles.reqName}>{r.requirement_name}</td>
                    <td className={styles.reqDesc}>{r.description}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.statusToggle}
                        onClick={() => toggleCompliance(r)}
                      >
                        <Badge status={r.status || "Pending"} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
