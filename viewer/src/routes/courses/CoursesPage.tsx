import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { viewerApi } from "../../lib/api";
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
          <h1>登録科目</h1>
          <p className="muted">ローカルバックアップから復元したクラス一覧です。</p>
        </div>
      </div>
      <div className="course-grid">
        {courses.map((course) => (
          <Link className="course-card" key={course.courseId} to={`/courses/${encodeURIComponent(course.courseId)}`}>
            <div className="course-card-banner classroom-card-banner" style={{ background: course.bannerColor }}>
              <span className="course-card-title-overlay">{course.name}</span>
            </div>
            <div className="course-card-body">
              <p>{course.section || "クラス"}</p>
              <p className="muted">{course.room || "教室情報なし"}</p>
              <p className="muted">{course.updateTime ? new Date(course.updateTime).toLocaleString() : "更新時刻なし"}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
