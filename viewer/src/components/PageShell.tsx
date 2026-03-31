import React from "react";
import { Link } from "react-router-dom";

interface PageShellProps {
  children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          Classroom Backup Viewer
        </Link>
      </header>
      <main className="page-content">{children}</main>
    </div>
  );
}
