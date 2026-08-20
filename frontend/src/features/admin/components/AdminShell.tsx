import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

// Ordered by data dependency, not alphabetically: each page's prerequisite
// data should already exist by the time an admin reaches it. Dashboard
// stays first as the landing/overview page (it produces nothing, so it
// doesn't fit the dependency chain); History of Logs stays last since it's
// pure read-only output with no setup role. In between:
//   Users Management -> Positions: a Position's default panel members are
//     PANEL-role Users, picked from a dropdown - need accounts before you
//     can staff a position's board.
//   Positions -> Job Management: a job posting is optionally created from
//     a master Position (auto-assigns that position's default panel).
//   Categories / Compliance Requirements: independent rubric/checklist
//     catalogs with no FK to postings or applications, but both need to
//     exist before the phases that consume them (interview scoring,
//     compliance review) are reached - grouped here, after posting setup
//     and before the operational pages that read them.
//   Job Management -> Interview Panel: assigning a board requires the
//     posting (and its applicants) to already exist.
//   -> Group: Group Dynamics Evaluation groups applicants who've already
//     applied, so it needs Applications (postings + submissions) too.
//   -> Evaluate Applicants: the pipeline hub - sifting/PQE/interview/
//     compliance actions here depend on everything above already existing.
//   -> Report Summary: reads the interview scores Evaluate Applicants'
//     panel-scoring step produces, so it comes right after.
const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/users", label: "Users Management" },
  { to: "/admin/positions", label: "Positions" },
  { to: "/admin/jobs", label: "Job Management" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/compliance-requirements", label: "Compliance Requirements" },
  { to: "/admin/panel-interviews", label: "Interview Panel" },
  { to: "/admin/groups", label: "Group" },
  { to: "/admin/evaluations", label: "Evaluate Applicants" },
  { to: "/admin/report-summary", label: "Report Summary" },
  { to: "/admin/logs", label: "History of Logs" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  // Marks <body> (not just this subtree) so the admin-only blue/white button
  // hover in index.css also reaches modals/dialogs - Modal renders via
  // createPortal(..., document.body), landing as a sibling outside .admin-shell.
  useEffect(() => {
    document.body.classList.add("admin-account");
    return () => document.body.classList.remove("admin-account");
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-sidebar-title">Admin Panel</p>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className={location.pathname === item.to ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
