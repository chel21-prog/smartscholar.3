import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import styles from "./CoordinatorApplications.module.css";

export default function CoordinatorApplications() {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

const [currentPage, setCurrentPage] = useState(1);

const [rowsPerPage] = useState(10);
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
  useEffect(() => {
    setCurrentPage(1);
}, [filter, search]);

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

  const filtered = applications.filter((a) => {
    const keyword = search.toLowerCase();

    const student = getStudentName(a).toLowerCase();

    const scholarship =
        a.scholarships?.scholarship_name?.toLowerCase() || "";

    const year =
        a.academic_year?.toLowerCase() || "";

    const semester =
        a.semester?.toLowerCase() || "";

    const status =
        a.status?.toLowerCase() || "";

    const date =
        new Date(a.application_date)
            .toLocaleDateString()
            .toLowerCase();

    const matchesSearch =
        student.includes(keyword) ||
        scholarship.includes(keyword) ||
        year.includes(keyword) ||
        semester.includes(keyword) ||
        status.includes(keyword) ||
        date.includes(keyword);

    const matchesStatus =
        filter === "All" ||
        a.status === filter;

    return matchesSearch && matchesStatus;
});

  if (loading) return <p>Loading...</p>;

  const totalPages = Math.ceil(
    filtered.length / rowsPerPage
);

const paginated = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
);
  return (
    <div className={styles.page}>

      <div className={styles.header}>
  <div>
    <h1 className={styles.title}>Applications</h1>
    <p className={styles.subtitle}>
      Review scholarship applications, approve or reject submissions, and notify applicants.
    </p>
  </div>
</div>

<div className={styles.toolbar}>

    <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
        className={styles.search}
    />

    <select
        value={filter}
        onChange={(e)=>setFilter(e.target.value)}
        className={styles.select}
    >
        <option>All</option>
        <option>Pending</option>
        <option>Approved</option>
        <option>Rejected</option>
    </select>

</div>

      {/* TABLE */}

<div className={styles.tableContainer}>
<table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.th}>Student</th>
            <th className={styles.th}>Scholarship</th>
            <th className={`${styles.th} ${styles.colOptional}`}>AY Approved</th>
            <th className={`${styles.th} ${styles.colOptional}`}>Semester Approved</th>
            <th className={styles.th}>Status</th>
            <th className={`${styles.th} ${styles.colOptional}`}>Application Date</th>
            <th className={styles.th}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {paginated.map((a) => (
            <tr key={a.application_id}>
              <td className={styles.td}>{getStudentName(a)}</td>
              <td className={styles.td}>{a.scholarships?.scholarship_name}</td>
              <td className={`${styles.td} ${styles.colOptional}`}>{a.academic_year}</td>
              <td className={`${styles.td} ${styles.colOptional}`}>{a.semester}</td>
              <td className={styles.td}>{a.status}</td>
              <td className={`${styles.td} ${styles.colOptional}`}>
                {new Date(a.application_date).toLocaleDateString()}
              </td>

              <td
  className={styles.td}>

                <button className={`${styles.actionBtn} ${styles.viewBtn}`}
                 onClick={() => viewAnswers(a)}>
                  View
                </button>

                <button
  className={`${styles.actionBtn} ${styles.exportBtn}`}
  onClick={() => exportApplicationPDF(a)}
>
                  Export
                </button>

                {a.status === "Pending" && (
                  <>
                    <button
  className={`${styles.actionBtn} ${styles.approveBtn}`}
  onClick={() => openApproveModal(a)}
>
  Approve
</button>

                    <button
  className={`${styles.actionBtn} ${styles.rejectBtn}`}
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
<div className={styles.pagination}>
  <span className={styles.pageInfo}>
    Showing{" "}
    {filtered.length === 0
      ? 0
      : (currentPage - 1) * rowsPerPage + 1}
    {" - "}
    {Math.min(currentPage * rowsPerPage, filtered.length)} of{" "}
    {filtered.length}
  </span>

  <div className={styles.pageButtons}>
    <button
      className={styles.pageBtn}
      disabled={currentPage === 1}
      onClick={() => setCurrentPage((p) => p - 1)}
    >
      Previous
    </button>

    <span className={styles.pageInfo}>
      Page {totalPages === 0 ? 0 : currentPage} of {totalPages || 1}
    </span>

    <button
      className={styles.pageBtn}
      disabled={
        currentPage === totalPages ||
        totalPages === 0
      }
      onClick={() => setCurrentPage((p) => p + 1)}
    >
      Next
    </button>
  </div>
</div>
      {/* MODAL */}
      {selectedApp && (
        <div className={styles.overlay}>
          <div className={styles.modal}>

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

<div className={styles.overlay}>
  <div className={styles.modal}>

    <div className={styles.modalHeader}>
      <div>
        <h2 className={styles.modalTitle}>Approve Application</h2>
        <p className={styles.modalSubtitle}>
          Review and customize the notification before approving this application.
        </p>
      </div>

      <button
        className={styles.closeBtn}
        onClick={() => setApproveOpen(false)}
      >
        ✕
      </button>
    </div>

    <div className={styles.modalBody}>

      <div className={styles.field}>
        <label className={styles.label}>
          Notification Title
        </label>

        <input
          className={styles.input}
          value={notificationTitle}
          onChange={(e)=>setNotificationTitle(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Notification Message
        </label>

        <textarea
          className={styles.textarea}
          rows={8}
          value={notificationMessage}
          onChange={(e)=>setNotificationMessage(e.target.value)}
        />
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={sendNotification}
          onChange={() => setSendNotification(!sendNotification)}
        />

        <span>
          Send notification to the student
        </span>
      </label>

    </div>

    <div className={styles.modalFooter}>

      <button
        className={styles.secondaryBtn}
        onClick={() => setApproveOpen(false)}
      >
        Cancel
      </button>

      <button
        onClick={approveApplication}
        className={`${styles.actionBtn} ${styles.approveBtn}`}
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
    <div className={styles.overlay}>
  <div className={styles.modal}>

    <div className={styles.modalHeader}>
      <div>
        <h2 className={styles.modalTitle}>Reject Application</h2>
        <p className={styles.modalSubtitle}>
          Review and customize the notification before rejecting this application.
        </p>
      </div>

      <button
        className={styles.closeBtn}
        onClick={() => setRejectOpen(false)}
      >
        ✕
      </button>
    </div>

    <div className={styles.modalBody}>

      <div className={styles.field}>
        <label className={styles.label}>
          Notification Title
        </label>

        <input
          className={styles.input}
          value={notificationTitle}
          onChange={(e)=>setNotificationTitle(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Notification Message
        </label>

        <textarea
          className={styles.textarea}
          rows={8}
          value={notificationMessage}
          onChange={(e)=>setNotificationMessage(e.target.value)}
        />
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={sendNotification}
          onChange={() => setSendNotification(!sendNotification)}
        />

        <span>
          Send notification to the student
        </span>
      </label>

    </div>

    <div className={styles.modalFooter}>

      <button
        className={styles.secondaryBtn}
        onClick={() => setRejectOpen(false)}
      >
        Cancel
      </button>

      <button
        onClick={rejectApplication}
        className={`${styles.actionBtn} ${styles.rejectBtn}`}
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