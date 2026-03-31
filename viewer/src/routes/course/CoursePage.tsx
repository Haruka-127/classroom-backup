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
    return <p className="muted">Loading course...</p>;
  }

  return (
    <section className="stack-lg">
      <Link className="back-link" to="/">
        Back to classes
      </Link>
      <header className="course-hero" style={{ background: course.bannerColor }}>
        <p>{course.section || "No section"}</p>
        <h1>{course.name}</h1>
        <p>{course.room || "No room"}</p>
      </header>
      {course.descriptionHeading || course.description ? (
        <section className="panel stack-sm">
          {course.descriptionHeading ? <h2>{course.descriptionHeading}</h2> : null}
          {course.description ? <p>{course.description}</p> : null}
        </section>
      ) : null}
      {course.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      <nav className="tabs" aria-label="Course tabs">
        <button className={tab === "stream" ? "tab-active" : ""} onClick={() => setSearchParams({ tab: "stream" })} type="button">
          Stream
        </button>
        <button className={tab === "classwork" ? "tab-active" : ""} onClick={() => setSearchParams({ tab: "classwork" })} type="button">
          Classwork
        </button>
      </nav>
      {tab === "stream" ? <StreamTab stream={stream} /> : <ClassworkTab classwork={classwork} />}
    </section>
  );
}
