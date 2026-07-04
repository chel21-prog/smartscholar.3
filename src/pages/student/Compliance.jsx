import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Badge, EmptyState } from "@/components/ui/Card";
import { TableWrap, Table } from "@/components/ui/Table";
import PageLoader from "@/components/ui/PageLoader";
import styles from "./Compliance.module.css";

export default function Compliance() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  // Per-row upload state: a Set of "<application_id>|<requirement_name>"
  // keys that are currently uploading. Fixes the bug where one active
  // upload was disabling every file input on the page simultaneously.
  const [uploadingKeys, setUploadingKeys] = useState(new Set());

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: userProfile } = await supabase
        .from("users")
        .select("user_id")
        .eq("auth_id", user.id)
        .single();

      const { data: student } = await supabase
        .from("students")
        .select("student_id")
        .eq("user_id", userProfile.user_id)
        .single();

      const { data: grantees } = await supabase
        .from("grantees")
        .select(`
          grantee_id,
          application_id,
          scholarship_id,
          scholarships ( scholarship_name )
        `)
        .eq("student_id", student.student_id);

      const grouped = {};

      for (const g of grantees || []) {
        const scholarshipId = g.scholarship_id;
        const applicationId = g.application_id;
        const key = `${scholarshipId}-${applicationId}`;

        if (!grouped[key]) {
          grouped[key] = {
            scholarship_name: g.scholarships?.scholarship_name,
            application_id: applicationId,
            requirements: {},
          };
        }

        const { data: reqLinks } = await supabase
          .from("scholarship_requirements")
          .select(`application_requirements ( requirement_name )`)
          .eq("scholarship_id", scholarshipId);

        const { data: docs } = await supabase
          .from("application_documents")
          .select("*")
          .eq("application_id", applicationId);

        reqLinks?.forEach((r) => {
          const reqName = r.application_requirements?.requirement_name;
          if (!reqName) return;

          const existing = docs?.find((d) => d.requirement_name === reqName);

          grouped[key].requirements[reqName] = {
            requirement_name: reqName,
            file_url: existing?.file_url || null,
          };
        });
      }

      setRows(Object.values(grouped));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (e, row) => {
    if (!row.application_id || !row.requirement_name) {
      alert("Missing application ID or requirement name.");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected after an error
    e.target.value = "";

    const uploadKey = `${row.application_id}|${row.requirement_name}`;
    setUploadingKeys((prev) => new Set([...prev, uploadKey]));

    try {
      const safeRequirement = row.requirement_name.replace(/\s+/g, "_");
      const filePath = `${row.application_id}/${safeRequirement}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("application-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert(uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("application-documents")
        .getPublicUrl(filePath);

      await supabase.from("application_documents").upsert({
        application_id: row.application_id,
        requirement_name: row.requirement_name,
        file_url: urlData.publicUrl,
      });

      await load();
    } catch (err) {
      console.error(err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(uploadKey);
        return next;
      });
    }
  };

  if (loading) return <PageLoader label="Loading your compliance requirements…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Compliance requirements</h1>
        <p className={styles.subtitle}>
          Upload the required documents for each active scholarship grant.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="📋"
            title="No compliance requirements yet"
            description="When a coordinator adds you as a grantee, your required documents will appear here."
          />
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.application_id} className={styles.scholarshipCard}>
            <div className={styles.scholarshipLabel}>
              <span className={styles.pin}>📌</span>
              {r.scholarship_name}
            </div>

            {Object.keys(r.requirements).length === 0 ? (
              <p className={styles.noReqs}>No document requirements listed for this grant.</p>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Status</th>
                      <th>File</th>
                      <th>Upload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(r.requirements).map((req) => {
                      const uploadKey = `${r.application_id}|${req.requirement_name}`;
                      const isUploading = uploadingKeys.has(uploadKey);

                      return (
                        <tr key={req.requirement_name}>
                          <td className={styles.reqName}>{req.requirement_name}</td>

                          <td>
                            <Badge status={req.file_url ? "Submitted" : "Missing"} />
                          </td>

                          <td>
                            {req.file_url ? (
                              <a
                                href={req.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.viewLink}
                              >
                                View ↗
                              </a>
                            ) : (
                              <span className={styles.noFile}>—</span>
                            )}
                          </td>

                          <td>
                            <label
                              className={`${styles.uploadLabel} ${
                                isUploading ? styles.uploadLabelBusy : ""
                              }`}
                            >
                              {isUploading ? (
                                <>
                                  <span className={styles.uploadSpinner} />
                                  Uploading…
                                </>
                              ) : (
                                <>
                                  <span className={styles.uploadIcon}>↑</span>
                                  {req.file_url ? "Replace" : "Upload"}
                                </>
                              )}
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                className={styles.hiddenInput}
                                disabled={isUploading}
                                onChange={(e) =>
                                  uploadFile(e, {
                                    application_id: r.application_id,
                                    requirement_name: req.requirement_name,
                                  })
                                }
                              />
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
