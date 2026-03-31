import React from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";

import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import type { ViewerClassworkResponse, ViewerCourseDetail, ViewerStreamResponse } from "../../lib/types";
import { ClassworkTab } from "./ClassworkTab";
import { StreamTab } from "./StreamTab";

export function CoursePage() {
  const { courseId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "classwork" ? "classwork" : "stream";
  const [course, setCourse] = useState<ViewerCourseDetail | null>(null);
  const [stream, setStream] = useState<ViewerStreamResponse | null>(null);
  const [classwork, setClasswork] = useState<ViewerClassworkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const decodedCourseId = decodeURIComponent(courseId);
    void Promise.all([
      viewerApi.getCourse(decodedCourseId),
      viewerApi.getStream(decodedCourseId),
      viewerApi.getClasswork(decodedCourseId),
    ])
      .then(([courseResponse, streamResponse, classworkResponse]) => {
        if (!cancelled) {
          setCourse(courseResponse);
          setStream(streamResponse);
          setClasswork(classworkResponse);
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
  }, [courseId]);

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!course || !stream || !classwork) {
    return <p className="muted">クラスを読み込み中...</p>;
  }

  return (
    <section className="classroom-course-page stack-lg">
      <div className="course-title-row">
        <Link className="back-link" to="/">
          Classroom
        </Link>
        <span className="muted">›</span>
        <span>{course.name}</span>
      </div>
      <nav className="tabs classroom-tabs" aria-label="Course tabs">
        <button className={tab === "stream" ? "tab-active" : ""} onClick={() => setSearchParams({ tab: "stream" })} type="button">
          ストリーム
        </button>
        <button className={tab === "classwork" ? "tab-active" : ""} onClick={() => setSearchParams({ tab: "classwork" })} type="button">
          授業
        </button>
      </nav>
      <header className="course-hero classroom-course-hero" style={{ background: course.bannerColor }}>
        <div className="course-hero-copy">
          <p>{course.section || "クラス"}</p>
          <h1>{course.name}</h1>
          <p>{course.room || ""}</p>
        </div>
        <div className="course-hero-art" aria-hidden="true">
          <span className="hero-shape hero-book" />
          <span className="hero-shape hero-frame" />
          <span className="hero-shape hero-sheet" />
        </div>
      </header>
      {course.descriptionHeading || course.description ? (
        <section className="panel stack-sm classroom-course-summary">
          {course.descriptionHeading ? <h2>{course.descriptionHeading}</h2> : null}
          {course.description ? <p>{course.description}</p> : null}
        </section>
      ) : null}
      {course.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      {tab === "stream" ? <StreamTab stream={stream} /> : <ClassworkTab classwork={classwork} />}
    </section>
  );
}
