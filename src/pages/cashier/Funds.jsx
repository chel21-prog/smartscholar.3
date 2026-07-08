import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "./Funds.module.css";

const PAGE_SIZE = 8;

export default function Funds() {

    /* =====================================================
       STATE
    ===================================================== */

    const [loading, setLoading] = useState(true);

    const [scholarships, setScholarships] = useState([]);

    const [search, setSearch] = useState("");

    const [filter, setFilter] = useState("All");

    const [page, setPage] = useState(1);

    const [selectedScholarship, setSelectedScholarship] = useState(null);

    const [selectedGrantee, setSelectedGrantee] = useState(null);

    const [releaseModal, setReleaseModal] = useState(false);

    const [historyModal, setHistoryModal] = useState(false);

    const [remarks, setRemarks] = useState("");

    /* =====================================================
       LOAD DATA
    ===================================================== */

    useEffect(() => {

        loadScholarships();

    }, []);

    async function loadScholarships() {

    setLoading(true);

    const { data, error } = await supabase

        .from("scholarships")

        .select(`
            scholarship_id,
            scholarship_name,
            sponsor,
            amount,
            total_budget,

            grantees(
                grantee_id,
                student_id,
                academic_year,
                semester,
                status,

                students(
                    student_id,
                    school_id,

                    users(
                        user_id,
                        first_name,
                        last_name
                    )
                ),

                fund_releases(
                    release_id,
                    amount_released,
                    release_date,
                    status,
                    remarks
                )
            )
        `)

        .order("scholarship_name");

    if (error) {

        console.error(error);

        setScholarships([]);

        setLoading(false);

        return [];

    }

    setScholarships(data || []);

    setLoading(false);

    return data || [];

}

    /* =====================================================
       HELPER FUNCTIONS
    ===================================================== */

    function releasedAmount(scholarship) {

        if (!scholarship.grantees)

            return 0;

        return scholarship.grantees.reduce((total, grantee) => {

            const releases = grantee.fund_releases || [];

            return total +

                releases.reduce(

                    (sum, release) =>

                        sum + Number(release.amount_released || 0),

                    0

                );

        }, 0);

    }

    function remainingBudget(scholarship) {

        return Number(

            scholarship.total_budget || 0

        ) - releasedAmount(scholarship);

    }

    function progress(scholarship) {

        const budget = Number(

            scholarship.total_budget || 0

        );

        if (budget === 0)

            return 0;

        return Math.min(

            (releasedAmount(scholarship) / budget) * 100,

            100

        );

    }

    function latestRelease(grantee) {

        if (!grantee.fund_releases?.length)

            return null;

        return [...grantee.fund_releases]

            .sort(

                (a, b) =>

                    new Date(b.release_date) -

                    new Date(a.release_date)

            )[0];

    }

    /* =====================================================
   RELEASE FUND
===================================================== */

async function releaseFunds() {

    if (!selectedGrantee || !selectedScholarship)

        return;

    const amount = Number(

        selectedScholarship.amount || 0

    );
    const remaining = remainingBudget(selectedScholarship);

if (remaining < amount) {

    alert("Insufficient scholarship budget.");

    return;

}

    const today = new Date()

        .toISOString()

        .split("T")[0];

    const { error } = await supabase

        .from("fund_releases")

        .insert({

            grantee_id: selectedGrantee.grantee_id,

            academic_year: selectedGrantee.academic_year,

            semester: selectedGrantee.semester,

            amount_released: amount,

            release_date: today,

            status: "Released",

            remarks

        });

    if (error) {

        alert(error.message);

        return;

    }

    /* Refresh scholarship list */

const updatedScholarships = await loadScholarships();

const updated = updatedScholarships.find(

    scholarship =>

        scholarship.scholarship_id ===

        selectedScholarship.scholarship_id

);

if (updated) {

    setSelectedScholarship(updated);

}

setReleaseModal(false);

setSelectedGrantee(null);

setRemarks("");
    alert("Funds released successfully.");

}

        /* =====================================================
       FILTERING
    ===================================================== */

    const filtered = useMemo(() => {

        return scholarships.filter((scholarship) => {

            const keyword = search.toLowerCase();

            const matchesSearch =

                scholarship.scholarship_name
                    ?.toLowerCase()
                    .includes(keyword)

                ||

                scholarship.sponsor
                    ?.toLowerCase()
                    .includes(keyword);

            let matchesFilter = true;

            if (filter === "With Budget") {

                matchesFilter =

                    remainingBudget(scholarship) > 0;

            }

            if (filter === "Fully Released") {

                matchesFilter =

                    remainingBudget(scholarship) <= 0;

            }

            return matchesSearch && matchesFilter;

        });

    }, [scholarships, search, filter]);
        /* =====================================================
       PAGINATION
    ===================================================== */

    const totalPages = Math.max(

        1,

        Math.ceil(

            filtered.length / PAGE_SIZE

        )

    );

    const currentScholarships = filtered.slice(

        (page - 1) * PAGE_SIZE,

        page * PAGE_SIZE

    );

        /* =====================================================
       SUMMARY CARDS
    ===================================================== */

    const totalBudget = scholarships.reduce(

        (sum, scholarship) =>

            sum +

            Number(

                scholarship.total_budget || 0

            ),

        0

    );

    const totalReleased = scholarships.reduce(

        (sum, scholarship) =>

            sum +

            releasedAmount(scholarship),

        0

    );

    const totalRemaining =

        totalBudget -

        totalReleased;

            if (loading) {

        return (

            <div className={s.loading}>

                Loading scholarship funds...

            </div>

        );

    }

    return (

    <div className={s.page}>

        {/* ================= HEADER ================= */}

        <div className={s.pageHeader}>

            <div>

                <h1 className={s.pageTitle}>

                    Funds Management

                </h1>

                <p className={s.pageSubtitle}>

                    Monitor scholarship budgets, fund utilization, and payout releases.

                </p>

            </div>

        </div>

        {/* ================= SUMMARY ================= */}

        <div className={s.statsGrid}>

            <div className={s.statCard}>

                <span>Total Budget</span>

                <strong>

                    ₱{totalBudget.toLocaleString()}

                </strong>

            </div>

            <div className={s.statCard}>

                <span>Total Released</span>

                <strong className={s.successText}>

                    ₱{totalReleased.toLocaleString()}

                </strong>

            </div>

            <div className={s.statCard}>

                <span>Remaining Budget</span>

                <strong className={s.primaryText}>

                    ₱{totalRemaining.toLocaleString()}

                </strong>

            </div>

            <div className={s.statCard}>

                <span>Scholarships</span>

                <strong>

                    {scholarships.length}

                </strong>

            </div>

        </div>

        {/* ================= FILTER BAR ================= */}

        <div className={s.filterBar}>

            <input

                className={s.searchInput}

                type="text"

                placeholder="Search scholarship or sponsor..."

                value={search}

                onChange={(e) => {

                    setSearch(e.target.value);

                    setPage(1);

                }}

            />

            <select

                className={s.filterSelect}

                value={filter}

                onChange={(e) => {

                    setFilter(e.target.value);

                    setPage(1);

                }}

            >

                <option value="All">

                    All

                </option>

                <option value="With Budget">

                    With Budget

                </option>

                <option value="Fully Released">

                    Fully Released

                </option>

            </select>

        </div>
        {/* ================= SCHOLARSHIP TABLE ================= */}

<div className={s.tableWrap}>

    <table className={s.table}>

        <thead className={s.thead}>

            <tr>

                <th className={s.th}>Scholarship</th>

                <th className={s.th}>Sponsor</th>

                <th className={s.th}>Budget</th>

                <th className={s.th}>Released</th>

                <th className={s.th}>Remaining</th>

                <th className={s.th}>Grantees</th>

                <th className={s.th}>Progress</th>

                <th className={s.th}>Action</th>

            </tr>

        </thead>

        <tbody>

            {currentScholarships.length === 0 ? (

                <tr>

                    <td
                        colSpan={8}
                        className={s.emptyState}
                    >

                        No scholarship funds found.

                    </td>

                </tr>

            ) : (

                currentScholarships.map((scholarship) => {

                    const remaining =
                        remainingBudget(scholarship);

                    return (

                        <tr
                            key={scholarship.scholarship_id}
                        >

                            <td className={s.nameCell}>

                                <strong>

                                    {scholarship.scholarship_name}

                                </strong>

                            </td>

                            <td>

                                {scholarship.sponsor}

                            </td>

                            <td className={s.money}>

                                ₱

                                {Number(
                                    scholarship.total_budget || 0
                                ).toLocaleString()}

                            </td>

                            <td className={s.moneyReleased}>

                                ₱

                                {releasedAmount(
                                    scholarship
                                ).toLocaleString()}

                            </td>

                            <td
                                className={
                                    remaining <= 0
                                        ? s.moneyDanger
                                        : s.moneyRemaining
                                }
                            >

                                ₱

                                {remaining.toLocaleString()}

                            </td>

                            <td>

                                {scholarship.grantees?.length || 0}

                            </td>

                            <td>

                                <div className={s.progressMini}>

                                    <div

                                        className={s.progressMiniFill}

                                        style={{

                                            width:
                                                `${progress(
                                                    scholarship
                                                )}%`

                                        }}

                                    />

                                </div>

                            </td>

                            <td>

                                <button

                                    className={s.viewBtn}

                                    onClick={() =>

                                        setSelectedScholarship(
                                            scholarship
                                        )

                                    }

                                >

                                    View

                                </button>

                            </td>

                        </tr>

                    );

                })

            )}

        </tbody>

    </table>

</div>
{/* =====================================================
    SCHOLARSHIP DETAILS MODAL
===================================================== */}

{selectedScholarship && (

<div
    className={s.overlay}
    onClick={(e)=>{

        if(e.target===e.currentTarget){

            setSelectedScholarship(null);

        }

    }}
>

<div className={s.modalLarge}>

    {/* ---------- Header ---------- */}

    <div className={s.modalHeader}>

        <div>

            <h2 className={s.modalTitle}>

                {selectedScholarship.scholarship_name}

            </h2>

            <p className={s.modalSubtitle}>

                Sponsored by {selectedScholarship.sponsor}

            </p>

        </div>

        <button

            className={s.closeBtn}

            onClick={()=>

                setSelectedScholarship(null)

            }

        >

            ✕

        </button>

    </div>

    {/* ---------- Summary ---------- */}

    <div className={s.modalStats}>

        <div className={s.statMini}>

            <span>Budget</span>

            <strong>

                ₱{Number(

                    selectedScholarship.total_budget

                ).toLocaleString()}

            </strong>

        </div>

        <div className={s.statMini}>

            <span>Released</span>

            <strong className={s.successText}>

                ₱{releasedAmount(

                    selectedScholarship

                ).toLocaleString()}

            </strong>

        </div>

        <div className={s.statMini}>

            <span>Remaining</span>

            <strong className={s.primaryText}>

                ₱{remainingBudget(

                    selectedScholarship

                ).toLocaleString()}

            </strong>

        </div>

        <div className={s.statMini}>

            <span>Recipients</span>

            <strong>

                {selectedScholarship.grantees?.length || 0}

            </strong>

        </div>

    </div>

    {/* ---------- Progress ---------- */}

    <div className={s.progressSection}>

        <div className={s.progressHeader}>

            <span>

                Budget Utilization

            </span>

            <strong>

                {progress(

                    selectedScholarship

                ).toFixed(1)}%

            </strong>

        </div>

        <div className={s.progressBar}>

            <div

                className={s.progressFill}

                style={{

                    width:

                    `${progress(

                        selectedScholarship

                    )}%`

                }}

            />

        </div>

    </div>

    {/* =====================================================
    GRANTEES TABLE
===================================================== */}

<div className={s.tableWrap}>

    <table className={s.table}>

        <thead className={s.thead}>

            <tr>

                <th className={s.th}>Student</th>

                <th className={s.th}>School ID</th>

                <th className={s.th}>Academic Year</th>

                <th className={s.th}>Semester</th>

                <th className={s.th}>Release Status</th>

                <th className={s.th}>Release Date</th>

                <th className={s.th}>Amount</th>

                <th className={s.th}>Action</th>

            </tr>

        </thead>

        <tbody>

            {selectedScholarship.grantees?.length === 0 ? (

                <tr>

                    <td
                        colSpan={8}
                        className={s.emptyState}
                    >

                        No grantees assigned.

                    </td>

                </tr>

            ) : (

                selectedScholarship.grantees.map((grantee) => {

                    const latest = latestRelease(grantee);

                    const released = !!latest;

                    return (

                        <tr key={grantee.grantee_id}>

                            <td className={s.studentCell}>

                                <div className={s.studentName}>

                                    {grantee.students?.users?.first_name}{" "}

                                    {grantee.students?.users?.last_name}

                                </div>

                            </td>

                            <td>

                                {grantee.students?.school_id}

                            </td>

                            <td>

                                {grantee.academic_year}

                            </td>

                            <td>

                                {grantee.semester}

                            </td>

                            <td>

                                <span

                                    className={

                                        released

                                            ? s.badgeSuccess

                                            : s.badgeWarning

                                    }

                                >

                                    {released

                                        ? "Released"

                                        : "Pending"}

                                </span>

                            </td>

                            <td>

                                {latest?.release_date || "—"}

                            </td>

                            <td className={s.money}>

                                ₱

                                {Number(

                                    selectedScholarship.amount || 0

                                ).toLocaleString()}

                            </td>


    <td className={s.actionCell}>

    {released ? (

        <>

            <button
                className={s.btnReleased}
                disabled
            >
                Released
            </button>

            <button
                className={s.historyBtn}
                onClick={() => {

                    setSelectedGrantee(grantee);

                    setHistoryModal(true);

                }}
            >
                History
            </button>

        </>

    ) : (

        <button

    className={s.btnPrimary}

    disabled={
        remainingBudget(selectedScholarship) <
        Number(selectedScholarship.amount || 0)
    }

    onClick={() => {

        setSelectedGrantee(grantee);

        setReleaseModal(true);

    }}

>

    {remainingBudget(selectedScholarship) <
    Number(selectedScholarship.amount || 0)

        ? "No Budget"

        : "Release"}

</button>

    )}

</td>


                        </tr>

                    );

                })

            )}

        </tbody>

    </table>

</div>
</div>

</div>

)}
    {/* =====================================================
    RELEASE FUND MODAL
===================================================== */}

{releaseModal && selectedGrantee && (

<div
    className={s.overlay}
    onClick={(e)=>{

        if(e.target===e.currentTarget){

            setReleaseModal(false);

            setSelectedGrantee(null);

        }

    }}
>

<div className={s.modal}>

    <div className={s.modalHeader}>

        <div>

            <h2 className={s.modalTitle}>

                Release Scholarship Fund

            </h2>

            <p className={s.modalSubtitle}>

                Confirm payout for this student

            </p>

        </div>

        <button

            className={s.closeBtn}

            onClick={() => {

                setReleaseModal(false);

                setSelectedGrantee(null);

            }}

        >

            ✕

        </button>

    </div>

    <div className={s.modalBody}>

        <div className={s.infoGrid}>

            <div>

                <label>Student</label>

                <strong>

                    {selectedGrantee.students?.users?.first_name}{" "}

                    {selectedGrantee.students?.users?.last_name}

                </strong>

            </div>

            <div>

                <label>School ID</label>

                <strong>

                    {selectedGrantee.students?.school_id}

                </strong>

            </div>

            <div>

                <label>Scholarship</label>

                <strong>

                    {selectedScholarship?.scholarship_name}

                </strong>

            </div>

            <div>

                <label>Amount</label>

                <strong className={s.successText}>

                    ₱{Number(

                        selectedScholarship?.amount || 0

                    ).toLocaleString()}

                </strong>

            </div>

        </div>

        <div className={s.field}>

            <label>Remarks (Optional)</label>

            <textarea

                className={s.textarea}

                rows={4}

                value={remarks}

                onChange={(e)=>

                    setRemarks(e.target.value)

                }

                placeholder="Enter remarks..."

            />

        </div>

    </div>

    <div className={s.modalFooter}>

        <button

            className={s.btnSecondary}

            onClick={() => {

                setReleaseModal(false);

                setSelectedGrantee(null);

            }}

        >

            Cancel

        </button>

        <button

            className={s.btnPrimary}

            onClick={releaseFunds}

        >

            Confirm Release

        </button>

    </div>

</div>

</div>

)}
{/* =====================================================
    RELEASE HISTORY MODAL
===================================================== */}

{historyModal && selectedGrantee && (

<div
    className={s.overlay}
    onClick={(e)=>{

        if(e.target===e.currentTarget){

            setHistoryModal(false);

            setSelectedGrantee(null);

        }

    }}
>

<div className={s.modalLarge}>

    <div className={s.modalHeader}>

        <div>

            <h2 className={s.modalTitle}>

                Release History

            </h2>

            <p className={s.modalSubtitle}>

                {selectedGrantee.students?.users?.first_name}{" "}

                {selectedGrantee.students?.users?.last_name}

            </p>

        </div>

        <button

            className={s.closeBtn}

            onClick={() => {

                setHistoryModal(false);

                setSelectedGrantee(null);

            }}

        >

            ✕

        </button>

    </div>

    <div className={s.modalBody}>

        <div className={s.tableWrap}>

            <table className={s.table}>

                <thead className={s.thead}>

                    <tr>

                        <th className={s.th}>Release Date</th>

                        <th className={s.th}>Academic Year</th>

                        <th className={s.th}>Semester</th>

                        <th className={s.th}>Amount</th>

                        <th className={s.th}>Status</th>

                        <th className={s.th}>Remarks</th>

                    </tr>

                </thead>

                <tbody>

                    {selectedGrantee.fund_releases?.length ? (

                        [...selectedGrantee.fund_releases]

                        .sort(

                            (a,b)=>

                                new Date(b.release_date) -

                                new Date(a.release_date)

                        )

                        .map((release)=>(

                            <tr key={release.release_id}>

                                <td>

                                    {release.release_date}

                                </td>

                                <td>

                                    {selectedGrantee.academic_year}

                                </td>

                                <td>

                                    {selectedGrantee.semester}

                                </td>

                                <td className={s.money}>

                                    ₱

                                    {Number(

                                        release.amount_released

                                    ).toLocaleString()}

                                </td>

                                <td>

                                    <span className={s.badgeSuccess}>

                                        {release.status}

                                    </span>

                                </td>

                                <td>

                                    {release.remarks || "—"}

                                </td>

                            </tr>

                        ))

                    ) : (

                        <tr>

                            <td

                                colSpan={6}

                                className={s.emptyState}

                            >

                                No release history found.

                            </td>

                        </tr>

                    )}

                </tbody>

            </table>

        </div>

    </div>

</div>

</div>

)}

    </div>

);

}