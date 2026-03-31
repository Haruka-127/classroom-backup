import React from "react";
import { Link } from "react-router-dom";

import { useViewerShell } from "./ViewerShellContext";

interface PageShellProps {
  children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  const { courses, currentCourseId } = useViewerShell();

  return (
    <div className="app-shell">
      <header className="topbar classroom-topbar">
        <div className="topbar-left">
          <button className="icon-button" type="button" aria-label="メニュー">
            ☰
          </button>
          <Link className="brand classroom-brand" to="/">
            <span className="brand-badge">▦</span>
            <span>Classroom</span>
          </Link>
        </div>
        <div className="topbar-right">
          <span className="avatar-chip" aria-hidden="true">
            W
          </span>
        </div>
      </header>
      <div className="classroom-body">
        <aside className="classroom-sidebar">
          <nav className="sidebar-nav" aria-label="ナビゲーション">
            <Link className="sidebar-link" to="/">
              <span className="sidebar-icon">⌂</span>
              <span>ホーム</span>
            </Link>
            <div className="sidebar-link sidebar-link-static">
              <span className="sidebar-icon">☰</span>
              <span>登録科目</span>
            </div>
          </nav>
          <div className="sidebar-course-list">
            {courses.map((course) => {
              const isCurrent = currentCourseId === course.courseId;
              return (
                <Link className={`sidebar-course-link${isCurrent ? " is-current" : ""}`} key={course.courseId} to={`/courses/${encodeURIComponent(course.courseId)}`}>
                  <span className="sidebar-course-avatar">{course.name.slice(0, 1)}</span>
                  <span className="sidebar-course-meta">
                    <strong>{course.name}</strong>
                    {course.section ? <small>{course.section}</small> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>
        <main className="page-content classroom-content">{children}</main>
      </div>
    </div>
  );
}
