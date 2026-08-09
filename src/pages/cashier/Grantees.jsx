import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import StatCard from "@/components/ui/StatCard";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { getCached, setCached } from "@/lib/dataCache";
import s from "./Grantees.module.css";

const PAGE_SIZE = 10;
const CACHE_KEY = "cashier-grantees";

export default function Grantees() {

    const cachedRows = getCached(CACHE_KEY);
    const [loading,setLoading] = useState(!cachedRows);

    const [rows,setRows] = useState(cachedRows || []);

    const [search,setSearch] = useState("");

    const [statusFilter,setStatusFilter] = useState("All");

    const [scholarshipFilter,setScholarshipFilter] = useState("All");

    const [page,setPage] = useState(1);

    const [selected,setSelected] = useState(null);

    const [remarks,setRemarks] = useState("");

    const [releaseOpen,setReleaseOpen] = useState(false);

    useEffect(()=>{

        load();

    },[]);

    async function load(){

        if (!getCached(CACHE_KEY)) setLoading(true);

        const {data,error}=await supabase

        .from("grantees")

        .select(`
            *,
            students(
                student_id,
                school_id,
                course,
                year_level,
                users(
                    first_name,
                    last_name
                )
            ),
            scholarships(
                scholarship_name,
                sponsor,
                amount,
                total_budget
            ),
            fund_releases(
                release_id,
                amount_released,
                release_date,
                status,
                remarks
            )
        `)

        .order("grantee_id",{ascending:false});

        if(error){

            console.log(error);

            setRows([]);

        }

        else{

            setRows(data||[]);

            setCached(CACHE_KEY, data||[]);

        }

        setLoading(false);

    }

    const scholarshipOptions = useMemo(()=>{

        return [

            "All",

            ...new Set(

                rows

                .map(r=>r.scholarships?.scholarship_name)

                .filter(Boolean)

            )

        ];

    },[rows]);

    const filtered = rows.filter(row=>{

        const fullname =

        `${row.students?.users?.first_name || ""} ${row.students?.users?.last_name || ""}`

        .toLowerCase();

        const keyword = search.toLowerCase();

        const matchesSearch=

        fullname.includes(keyword)

        ||

        row.students?.school_id?.toLowerCase().includes(keyword)

        ||

        row.scholarships?.scholarship_name?.toLowerCase().includes(keyword)

        ||

        String(row.scholarships?.amount||"").includes(keyword)

        ||

        releaseStatus(row).toLowerCase().includes(keyword)

        ||

        (releaseDate(row)||"").toLowerCase().includes(keyword);

        const matchesStatus=

        statusFilter==="All"

        ||

        row.status===statusFilter;

        const matchesScholarship=

        scholarshipFilter==="All"

        ||

        row.scholarships?.scholarship_name===scholarshipFilter;

        return(

            matchesSearch &&

            matchesStatus &&

            matchesScholarship

        );

    });

    const totalPages=Math.ceil(filtered.length/PAGE_SIZE);

    const currentRows=

    filtered.slice(

        (page-1)*PAGE_SIZE,

        page*PAGE_SIZE

    );

    function openRelease(grantee){

        setSelected(grantee);

        setRemarks("");

        setReleaseOpen(true);

    }

    function closeRelease(){

        setSelected(null);

        setRemarks("");

        setReleaseOpen(false);

    }

    async function releaseFunds() {

    if (!selected) return;

    const amount = Number(selected.scholarships?.amount || 0);

    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
        .from("fund_releases")
        .insert({
            grantee_id: selected.grantee_id,
            academic_year: selected.academic_year,
            semester: selected.semester,
            amount_released: amount,
            release_date: today,
            status: "Released",
            remarks
        });

    if (error) {
        alert(error.message);
        return;
    }

    await supabase
        .from("notifications")
        .insert({
            user_id: selected.students.user_id,
            title: "Scholarship Released",
            message: `Your scholarship payout of ₱${amount.toLocaleString()} has been released.`,
            notification_type: "Fund Release"
        });

    closeRelease();

    load();
}

async function undoRelease(grantee){

    const latest =
        grantee.fund_releases?.[0];

    if(!latest){

        alert("No released fund found.");

        return;

    }

    if(!window.confirm("Undo this payout?"))

        return;

    await supabase

        .from("fund_releases")

        .delete()

        .eq("release_id",latest.release_id);

    load();

}

function latestRelease(grantee){

    if(!grantee.fund_releases)

        return null;

    if(grantee.fund_releases.length===0)

        return null;

    return grantee.fund_releases[0];

}

function releaseStatus(grantee){

    return latestRelease(grantee)

        ? "Released"

        : "Pending";

}

function releaseDate(grantee){

    return latestRelease(grantee)?.release_date

        || "—";

}

const releasedCount =

rows.filter(

g=>releaseStatus(g)==="Released"

).length;

const pendingCount=

rows.length-releasedCount;

return (

<div className={s.page}>

    <div className={s.header}>

        <div>

            <h1>Grantees</h1>

            <p>
                Manage scholarship payouts and monitor released funds.
            </p>

        </div>

    </div>

    <div className={s.summaryGrid}>

        <StatCard
            label="Total Grantees"
            value={rows.length}
            explain="Total number of grantee records currently loaded."
        />

        <StatCard
            label="Released"
            value={releasedCount}
            tone="success"
            explain="Grantees whose most recent/derived release status is &quot;Released&quot;."
        />

        <StatCard
            label="Pending"
            value={pendingCount}
            tone="warning"
            explain="Total Grantees minus Released — grantees who haven't had a fund release yet."
        />

    </div>

    <SearchFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by student, school ID, scholarship, amount, status, date..."
        resultCount={filtered.length}
        totalCount={rows.length}
        filters={[
            {
                label: "Status",
                value: statusFilter,
                onChange: (v) => { setStatusFilter(v); setPage(1); },
                options: [
                    { value: "All", label: "All Status" },
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                    { value: "Pending", label: "Pending" },
                ],
            },
            {
                label: "Scholarship",
                value: scholarshipFilter,
                onChange: (v) => { setScholarshipFilter(v); setPage(1); },
                options: scholarshipOptions.map((o) => ({ value: o, label: o === "All" ? "All Scholarships" : o })),
                width: 220,
            },
        ]}
    />

    <div className={s.tableContainer}>

        <table className={s.table}>

            <thead className={s.thead}>

                <tr>

                    <th>Student</th>

                    <th>School ID</th>

                    <th>Scholarship</th>

                    <th>Amount</th>

                    <th>Status</th>

                    <th>Release Date</th>

                    <th>Action</th>

                </tr>

            </thead>

            <tbody>

                {loading ? (
                    <tr>
                        <td colSpan={7} style={{ padding: "14px 16px" }}>
                            <TableSkeleton columns={7} rows={6} />
                        </td>
                    </tr>
                ) : currentRows.map(grantee=>(

                    <tr key={grantee.grantee_id}>

                        <td>

                            {grantee.students?.users?.first_name}{" "}

                            {grantee.students?.users?.last_name}

                        </td>

                        <td>

                            {grantee.students?.school_id}

                        </td>

                        <td>

                            {grantee.scholarships?.scholarship_name}

                        </td>

                        <td>

                            ₱{Number(

                                grantee.scholarships?.amount||0

                            ).toLocaleString()}

                        </td>

                        <td>

                            <span

                                className={

                                    releaseStatus(grantee)==="Released"

                                    ?

                                    s.badgeSuccess

                                    :

                                    s.badgePending

                                }

                            >

                                {releaseStatus(grantee)}

                            </span>

                        </td>

                        <td>

                            {releaseDate(grantee)}

                        </td>

                        <td>

                            {

                                releaseStatus(grantee)==="Released"

                                ?

                                <button

                                    className={s.undoBtn}

                                    onClick={()=>undoRelease(grantee)}

                                >

                                    Undo

                                </button>

                                :

                                <button

                                    className={s.releaseBtn}

                                    onClick={()=>openRelease(grantee)}

                                >

                                    Release

                                </button>

                            }

                        </td>

                    </tr>

                ))}

            </tbody>

        </table>

    </div>

    <div className={s.pagination}>

        <button

            disabled={page===1}

            onClick={()=>setPage(page-1)}

        >

            Previous

        </button>

        <span>

            Page {page} of {totalPages||1}

        </span>

        <button

            disabled={page===totalPages||totalPages===0}

            onClick={()=>setPage(page+1)}

        >

            Next

        </button>

    </div>

    {

        releaseOpen && selected && (

        <div className={s.overlay}>

            <div className={s.modal}>

                <h2>

                    Release Scholarship

                </h2>

                <p>

                    Student:

                    <strong>

                        {" "}

                        {selected.students?.users?.first_name}

                        {" "}

                        {selected.students?.users?.last_name}

                    </strong>

                </p>

                <p>

                    Scholarship:

                    <strong>

                        {" "}

                        {selected.scholarships?.scholarship_name}

                    </strong>

                </p>

                <p>

                    Amount:

                    <strong>

                        {" "}

                        ₱{Number(

                            selected.scholarships?.amount||0

                        ).toLocaleString()}

                    </strong>

                </p>

                <textarea

                    placeholder="Remarks"

                    value={remarks}

                    onChange={(e)=>setRemarks(e.target.value)}

                />

                <div className={s.modalButtons}>

                    <button

                        onClick={closeRelease}

                    >

                        Cancel

                    </button>

                    <button

                        className={s.releaseBtn}

                        onClick={releaseFunds}

                    >

                        Confirm Release

                    </button>

                </div>

            </div>

        </div>

        )

    }

</div>

);

}