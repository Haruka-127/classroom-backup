import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { viewerApi } from "../../lib/api";
import { formatCourseStateLabel } from "../../lib/labels";
import type { ViewerCourseCard } from "../../lib/types";

export function CoursesPage() {
  const [courses, setCourses] = useState<ViewerCourseCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void viewerApi
      .getCourses()
      .then((response) => {
        if (!cancelled) {
          setCourses(response.courses);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <section className="stack-lg classroom-home-page">
      <div className="home-hero">
        <div>
          <p className="home-hero-eyebrow">Classroom backup</p>
          <h1>登録済みのクラス</h1>
          <p className="muted">ローカルバックアップから復元したクラス一覧です。</p>
        </div>
        <div className="home-hero-stat" aria-label={`保存済みクラス数 ${courses.length}`}>
          <strong>{courses.length}</strong>
          <span className="muted">saved classes</span>
        </div>
      </div>
      <div className="course-grid">
        {courses.map((course) => (
          <Link className="course-card" key={course.courseId} to={`/courses/${encodeURIComponent(course.courseId)}`}>
            <div className="course-card-banner classroom-card-banner" style={{ backgroundColor: course.bannerColor }}>
              <div className="course-card-banner-content">
                <div className="course-card-heading">
                  <p className="course-card-section">{course.section || "クラス"}</p>
                  <span className="course-card-title-overlay">{course.name}</span>
                  <p className="course-card-room">{course.room || "教室情報なし"}</p>
                </div>
                <span className="course-card-avatar" aria-hidden="true">
                  {course.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="course-card-body">
              <p className="course-card-update">{course.updateTime ? new Date(course.updateTime).toLocaleString() : "更新時刻なし"}</p>
              {course.courseState ? <span className="pill course-state-pill">{formatCourseStateLabel(course.courseState)}</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
