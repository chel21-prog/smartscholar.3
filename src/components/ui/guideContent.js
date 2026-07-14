/**
 * Guide content, organized by role and then by page path. Keeping this
 * as plain data (rather than baking copy into the component) makes it
 * easy to update wording later without touching any component logic.
 */
const GUIDES = {
  Student: {
    overview:
      "This is your Student Portal. Keep your profile complete, browse and apply to scholarships, then upload compliance documents once you're a grantee.",
    pages: {
      "/student/dashboard": {
        title: "Dashboard",
        tips: [
          "\"Recommended for You\" ranks scholarships by total value over time (amount × how many payouts you'd actually receive before graduating) and how many requirements you're missing.",
          "Eligibility shown here is just a sorting guide, not a hard rule — you can apply to any scholarship, even ones you're not fully eligible for yet. The coordinator does the real eligibility check when reviewing your application.",
          "Use the sort toggle to switch between \"Best match\", \"Highest amount\", and \"Easiest to qualify\".",
        ],
      },
      "/student/profile": {
        title: "Profile",
        tips: [
          "Keep your course, year level, and personal details current — your year level is what makes the dashboard's value estimates for long-running scholarships accurate.",
          "Complete every field here before your dashboard and applications will unlock.",
        ],
      },
      "/student/applications": {
        title: "Applications",
        tips: [
          "Track the status of everything you've applied for — Pending, Approved, or Rejected.",
        ],
      },
      "/student/compliance": {
        title: "Compliance",
        tips: [
          "Once you're a grantee, upload whatever documents each scholarship still needs from you here.",
          "Each card is a separate scholarship grant, with its own requirement checklist.",
        ],
      },
      "/student/settings": {
        title: "Settings",
        tips: ["Change your password or sign out here."],
      },
    },
  },

  Coordinator: {
    overview:
      "This is the Coordinator Portal. Create and manage scholarships, review applications, verify grantees each term, and build reusable requirement/form templates.",
    pages: {
      "/coordinator/dashboard": {
        title: "Dashboard",
        tips: [
          "Quick overview of applications and grantees, plus report generation.",
        ],
      },
      "/coordinator/scholarships": {
        title: "Scholarships",
        tips: [
          "Payout Frequency and Duration together determine how many payouts Cashier will schedule for each grantee — set these carefully, they drive the whole payout schedule downstream.",
          "You can save an application form as a template while creating a scholarship, then load it again for future scholarships instead of rebuilding it.",
        ],
      },
      "/coordinator/students": {
        title: "Students",
        tips: ["The master roster of every registered student."],
      },
      "/coordinator/grantees": {
        title: "Grantees",
        tips: [
          "Verify each grantee every term — Eligible, Mismatch, or Ineligible. Cashier can only release funds to grantees marked Eligible/Verified.",
          "Use \"Extend\" to grant a specific student extra semesters if they're taking longer than the scholarship's normal duration to graduate — this only affects that one student, not the whole scholarship.",
        ],
      },
      "/coordinator/applications": {
        title: "Applications",
        tips: ["Review incoming applications and approve or reject them."],
      },
      "/coordinator/requirements": {
        title: "Requirements",
        tips: [
          "Build reusable application forms and eligibility/requirement checklists here.",
          "Save anything you build as a template so you're not reconstructing the same requirement list for every new scholarship.",
        ],
      },
      "/coordinator/settings": {
        title: "Settings",
        tips: ["Change your password or sign out here."],
      },
    },
  },

  Cashier: {
    overview:
      "This is the Cashier Portal. Review grantees and release scholarship payouts according to each scholarship's schedule.",
    pages: {
      "/cashier/dashboard": {
        title: "Dashboard",
        tips: ["Quick overview of recent fund activity."],
      },
      "/cashier/grantees": {
        title: "Grantees",
        tips: [
          "See every grantee's verification and payout status at a glance before jumping into Funds to release money.",
        ],
      },
      "/cashier/funds": {
        title: "Funds",
        tips: [
          "Open a grantee's Payout Schedule to see every period — Paid, Due, Skipped, or Discontinued — instead of guessing what's owed.",
          "Only grantees marked Verified/Active by the coordinator can receive a release — everyone else shows \"Not Verified\".",
          "Use \"Skip\" on a period the student legitimately isn't owed (leave of absence, didn't enroll that term) so the schedule moves on instead of getting stuck.",
        ],
      },
      "/cashier/settings": {
        title: "Settings",
        tips: ["Change your password or sign out here."],
      },
    },
  },
};

export default GUIDES;
