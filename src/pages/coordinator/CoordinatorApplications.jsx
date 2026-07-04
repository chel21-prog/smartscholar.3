import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function CoordinatorApplications() {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const HEADER_HEIGHT = 30;
const FOOTER_HEIGHT = 20;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 10;
const [approveOpen, setApproveOpen] = useState(false);

const [rejectOpen, setRejectOpen] = useState(false);

const [selectedApplication, setSelectedApplication] = useState(null);

const [notificationTitle, setNotificationTitle] = useState("");

const [notificationMessage, setNotificationMessage] = useState("");

const [sendNotification, setSendNotification] = useState(true);
  useEffect(() => {
    load();
  }, []);

  // =========================
  // LOAD APPLICATIONS
  // =========================
  const load = async () => {
    setLoading(true);

    const { data } = await supabase
  .from("scholarship_applications")
  .select(`
  application_id,
  status,
  application_date,
  academic_year,
  semester,
  scholarship_id,
  students (
  student_id,
  user_id,
  users (
    first_name,
    last_name
  )
),
  scholarships (
    scholarship_name
  )
`)
  .order("application_date", { ascending: false });

    setApplications(data || []);
    setLoading(false);
  };

  const getStudentName = (app) => {
  const u = app?.students?.users;
  if (!u) return "Unknown Student";
  return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
};

  const getBase64Image = async (url) => {
  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Image not found:", url);
      return null;
    }

    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Image load failed:", err);
    return null;
  }
};

  // =========================
  // VIEW ANSWERS
  // =========================
  const viewAnswers = async (app) => {
    setSelectedApp(app);

    const { data } = await supabase
      .from("application_form_responses")
      .select(`
        answer,
        scholarship_form_fields ( label )
      `)
      .eq("application_id", app.application_id);

    setAnswers(data || []);
  };

  // =========================
  // APPROVE / REJECT
  // =========================
  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from("scholarship_applications")
      .update({ status })
      .eq("application_id", id);

    if (error) return alert(error.message);

    setApplications((prev) =>
      prev.map((a) =>
        a.application_id === id ? { ...a, status } : a
      )
    );
  };
 
  const openApproveModal = (application) => {

setSelectedApplication(application);

setNotificationTitle(
"Scholarship Application Approved"
);

setNotificationMessage(
`Dear ${application.students.users.first_name},

Congratulations!

Your application for the ${application.scholarships.scholarship_name} scholarship has been approved.

You are now officially recognized as a scholarship grantee.

Thank you.`
);

setApproveOpen(true);

};

const openRejectModal = (application) => {
  setSelectedApplication(application);

  setNotificationTitle("Scholarship Application Rejected");

  setNotificationMessage(
`Dear ${application.students.users.first_name},

Thank you for applying for the ${application.scholarships.scholarship_name} scholarship.

After reviewing your application, we regret to inform you that it was not approved at this time.

You may contact the scholarship coordinator if you have any questions regarding your application.

Thank you.`
  );

  setSendNotification(true);

  setRejectOpen(true);
};

  const approveApplication = async () => {
  const app = selectedApplication;

  if (!app) return;
    const { error } = await supabase
      .from("scholarship_applications")
      .update({ status: "Approved" })
      .eq("application_id", app.application_id);

    if (error) return alert(error.message);

    await supabase.from("grantees").insert({
      
      student_id: app.students.student_id,
      scholarship_id: app.scholarship_id,
      application_id: app.application_id,
      status: "Active",
      date_awarded: new Date().toISOString().split("T")[0],
      academic_year: app.academic_year,
      semester: app.semester,
    });
    if (sendNotification) {
  const { error: notifError } = await supabase
  .from("notifications")
  .insert({
    user_id: app.students.user_id,
    title: notificationTitle,
    message: notificationMessage,
    notification_type: "Application",
  });

if (notifError) {
  console.error(notifError);
}

  if (notifError) {
    console.log(notifError);
  }
}

    setApplications((prev) =>
      prev.map((a) =>
        a.application_id === app.application_id
          ? { ...a, status: "Approved" }
          : a
      )
    );
    setApproveOpen(false);

setSelectedApplication(null);

setNotificationTitle("");

setNotificationMessage("");

setSendNotification(true);

await load();
  };

  const rejectApplication = async () => {
  const app = selectedApplication;

  if (!app) return;

  const { error } = await supabase
    .from("scholarship_applications")
    .update({
      status: "Rejected",
    })
    .eq("application_id", app.application_id);

  if (error) {
    return alert(error.message);
  }

  if (sendNotification) {
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: app.students.user_id,
        title: notificationTitle,
        message: notificationMessage,
        notification_type: "Application",
      });

    if (notifError) {
  console.error("Notification insert failed:", notifError);
  alert(JSON.stringify(notifError));
  return;
}
  }

  setApplications((prev) =>
    prev.map((a) =>
      a.application_id === app.application_id
        ? { ...a, status: "Rejected" }
        : a
    )
  );

  setRejectOpen(false);
  setSelectedApplication(null);
  setNotificationTitle("");
  setNotificationMessage("");
  setSendNotification(true);

  await load();
};

  // =========================
  // ⭐ EXPORT SINGLE APPLICATION
  // =========================
  const exportApplicationPDF = async (app) => {
  const headerImage = await getBase64Image("/header.png");
  const footerImage = await getBase64Image("/footer.png");

  const doc = new jsPDF();

  const { data } = await supabase
    .from("application_form_responses")
    .select(`
      answer,
      scholarship_form_fields ( label )
    `)
    .eq("application_id", app.application_id);

  const rows = (data || []).map((r) => [
    r.scholarship_form_fields?.label || "",
    r.answer || ""
  ]);

  autoTable(doc, {
    head: [["Field", "Answer"]],
    body: rows,

    startY: 80,

    didDrawPage: () => {
      addHeader(doc, app, headerImage);
      addFooter(doc, footerImage);
    },

    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
  });

  doc.save(`application_${app.application_id}.pdf`);
};

const addHeader = (doc, app, headerImage) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  let headerHeight = 25;

  if (headerImage) {
    const imgProps = doc.getImageProperties(headerImage);

    // Preserve aspect ratio
    headerHeight = (imgProps.height * pageWidth) / imgProps.width;

    // Limit maximum height
    headerHeight = Math.min(headerHeight, 35);

    doc.addImage(
      headerImage,
      "PNG",
      0,
      0,
      pageWidth,
      headerHeight
    );
  }

  doc.setFontSize(14);
  doc.text("APPLICATION REPORT", 14, headerHeight + 10);

  doc.setFontSize(10);
  doc.text(`Application ID: ${app.application_id}`, 14, headerHeight + 18);
  doc.text(`Student: ${getStudentName(app)}`, 14, headerHeight + 26);
  doc.text(
    `Scholarship: ${app.scholarships?.scholarship_name}`,
    14,
    headerHeight + 34
  );
};

const addFooter = (doc, footerImage) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let footerHeight = 20;

  if (footerImage) {
    const imgProps = doc.getImageProperties(footerImage);

    footerHeight = (imgProps.height * pageWidth) / imgProps.width;

    // Limit footer height
    footerHeight = Math.min(footerHeight, 25);

    doc.addImage(
      footerImage,
      "PNG",
      0,
      pageHeight - footerHeight,
      pageWidth,
      footerHeight
    );
  }

  doc.setFontSize(8);

  doc.text(
    `Page ${doc.internal.getNumberOfPages()}`,
    pageWidth - 25,
    pageHeight - footerHeight - 5
  );
};

  const filtered =
    filter === "All"
      ? applications
      : applications.filter((a) => a.status === filter);

  if (loading) return <p>Loading...</p>;


  return (
    <div style={styles.page}>

      <div style={styles.header}>
  <div>
    <h1 style={styles.title}>Applications</h1>
    <p style={styles.subtitle}>
      Review scholarship applications, approve or reject submissions, and notify applicants.
    </p>
  </div>
</div>

      {/* FILTER */}
      <div style={styles.filterContainer}>
        {["All", "Pending", "Approved", "Rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
  ...styles.filterBtn,
  ...(filter === f ? styles.filterBtnActive : {}),
}}
          >
            {f}
          </button>
        ))}
      </div>

      {/* TABLE */}
      {/* TABLE */}

<div style={styles.card}>
<table style={styles.table}>
        <thead style={styles.thead}>
          <tr>
            <th style={styles.th}>Student</th>
            <th style={styles.th}>Scholarship</th>
            <th style={styles.th}>AY Approved</th>
            <th style={styles.th}>Semester Approved</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Application Date</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((a) => (
            <tr key={a.application_id}>
              <td style={styles.td}>{getStudentName(a)}</td>
              <td style={styles.td}>{a.scholarships?.scholarship_name}</td>
              <td style={styles.td}>{a.academic_year}</td>
              <td style={styles.td}>{a.semester}</td>
              <td style={styles.td}>{a.status}</td>
              <td style={styles.td}>
                {new Date(a.application_date).toLocaleDateString()}
              </td>

              <td
  style={{
    ...styles.td,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  }}
>

                <button style={{
    ...styles.actionBtn,
    background: "#475c6c",
  }} onClick={() => viewAnswers(a)}>
                  View
                </button>

                <button
  style={{
    ...styles.actionBtn,
    background: "#8a8583",
  }}
  onClick={() => exportApplicationPDF(a)}
>
                  Export
                </button>

                {a.status === "Pending" && (
                  <>
                    <button
  style={{
    ...styles.actionBtn,
    background: "#16a34a",
  }}
  onClick={() => openApproveModal(a)}
>
  Approve
</button>

                    <button
  style={{
    ...styles.actionBtn,
    background: "#dc2626",
  }}
  onClick={() => {
    console.log("Reject button clicked");
    openRejectModal(a);
  }}
>
  Reject
</button>
                  </>
                )}

              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* MODAL */}
      {selectedApp && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <div style={styles.modal}>

            <h3>Answers</h3>

            {answers.map((r, i) => (
              <div key={i}>
                <b>{r.scholarship_form_fields?.label}</b>
                <p>{r.answer}</p>
              </div>
            ))}

            <button onClick={() => setSelectedApp(null)}>
              Close
            </button>

          </div>
        </div>
      )}

      {
approveOpen && (

<div style={styles.overlay}>

<div style={styles.modal}>

<h2>Approve Application</h2>

<input
style={styles.input}
placeholder="Notification title"

value={notificationTitle}

onChange={(e)=>setNotificationTitle(e.target.value)}

/>

<textarea
style={{
  ...styles.input,
  minHeight: 220,
  resize: "vertical",
}}
placeholder="Notification message"

rows={10}

value={notificationMessage}

onChange={(e)=>setNotificationMessage(e.target.value)}

/>

<label>

<input

type="checkbox"

checked={sendNotification}

onChange={()=>setSendNotification(!sendNotification)}

/>

Send notification

</label>

<div style={styles.modalActions}>

<button
onClick={()=>setApproveOpen(false)}
>

Cancel

</button>

<button
onClick={approveApplication}
style={{
  background: "#16a34a",
  color: "#fff",
  padding: "10px 18px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
}}
>
Approve Application
</button>

</div>

</div>

</div>

)
}

{
  rejectOpen && (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        <h2>Reject Application</h2>

        <input
          style={styles.input}
          placeholder="Notification title"
          value={notificationTitle}
          onChange={(e) => setNotificationTitle(e.target.value)}
        />

        <textarea
          style={{
            ...styles.input,
            minHeight: 220,
            resize: "vertical",
          }}
          rows={10}
          placeholder="Notification message"
          value={notificationMessage}
          onChange={(e) => setNotificationMessage(e.target.value)}
        />

        <label>
          <input
            type="checkbox"
            checked={sendNotification}
            onChange={() => setSendNotification(!sendNotification)}
          />
          Send notification
        </label>

        <div style={styles.modalActions}>
          <button onClick={() => setRejectOpen(false)}>
            Cancel
          </button>

          <button
            onClick={rejectApplication}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              cursor: "pointer",
            }}
          >
            Reject Application
          </button>
        </div>

      </div>
    </div>
  )
}

    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "#f5f6f8",
    fontFamily: "Inter, sans-serif",
    color: "#475c6c",
  },

  header: {
    marginBottom: 25,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 700,
    color: "#475c6c",
  },

  subtitle: {
    marginTop: 6,
    color: "#8a8583",
    fontSize: 14,
  },

  filterContainer: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },

  filterBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    color: "#475c6c",
    cursor: "pointer",
    fontWeight: 600,
    transition: ".2s",
  },

  filterBtnActive: {
    background: "#475c6c",
    color: "#fff",
    borderColor: "#475c6c",
  },

  card: {
    background: "#fff",
    borderRadius: 16,
    overflowX: "auto",
    boxShadow: "0 8px 24px rgba(0,0,0,.06)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1100,
  },

  thead: {
    background: "#475c6c",
  },

  th: {
    padding: 14,
    color: "#fff",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 14,
  },

  td: {
    padding: 14,
    borderBottom: "1px solid #ececec",
    color: "#475c6c",
    fontSize: 14,
  },

  actionBtn: {
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    transition: ".2s",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(71,92,108,.35)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },

  modal: {
    width: "100%",
    maxWidth: 650,
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 20px 40px rgba(0,0,0,.15)",
  },

  input: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ddd",
    marginTop: 10,
    marginBottom: 15,
    fontSize: 14,
    boxSizing: "border-box",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
};