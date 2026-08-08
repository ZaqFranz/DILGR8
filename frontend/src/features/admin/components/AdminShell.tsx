import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/jobs", label: "Job Management" },
  { to: "/admin/users", label: "Users Management" },
  { to: "/admin/evaluations", label: "Evaluate Applicants" },
  { to: "/admin/panel-interviews", label: "Interview Panel" },
  { to: "/admin/criteria", label: "Evaluation Criteria" },
  { to: "/admin/logs", label: "History of Logs" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();

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
