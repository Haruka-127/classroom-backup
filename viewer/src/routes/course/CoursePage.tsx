import React from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams, useParams } from "react-router-dom";

import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import { formatCourseStateLabel } from "../../lib/labels";
import type { ViewerClassworkResponse, ViewerCourseDetail, ViewerCoursePeopleResponse, ViewerStreamResponse } from "../../lib/types";
import { ClassworkTab } from "./ClassworkTab";
import { PeopleTab } from "./PeopleTab";
import { StreamTab } from "./StreamTab";

export function CoursePage() {
  const { courseId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "classwork" ? "classwork" : searchParams.get("tab") === "people" ? "people" : "stream";
  const [course, setCourse] = useState<ViewerCourseDetail | null>(null);
  const [stream, setStream] = useState<ViewerStreamResponse | null>(null);
  const [classwork, setClasswork] = useState<ViewerClassworkResponse | null>(null);
  const [people, setPeople] = useState<ViewerCoursePeopleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const decodedCourseId = decodeURIComponent(courseId);
    void Promise.all([
      viewerApi.getCourse(decodedCourseId),
      viewerApi.getStream(decodedCourseId),
      viewerApi.getClasswork(decodedCourseId),
      viewerApi.getPeople(decodedCourseId),
    ])
      .then(([courseResponse, streamResponse, classworkResponse, peopleResponse]) => {
        if (!cancelled) {
          setCourse(courseResponse);
          setStream(streamResponse);
          setClasswork(classworkResponse);
          setPeople(peopleResponse);
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

  if (!course || !stream || !classwork || !people) {
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
        <button className={tab === "people" ? "tab-active" : ""} onClick={() => setSearchParams({ tab: "people" })} type="button">
          メンバー
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
      {course.descriptionHeading || course.description || course.aliases.length > 0 || course.gradingPeriods.length > 0 || course.alternateLink || course.courseState || course.updateTime ? (
        <section className="panel stack-sm classroom-course-summary">
          {course.descriptionHeading ? <h2>{course.descriptionHeading}</h2> : null}
          {course.description ? <p>{course.description}</p> : null}
          {course.courseState ? <p className="muted">状態: {formatCourseStateLabel(course.courseState)}</p> : null}
          {course.updateTime ? <p className="muted">最終更新: {new Date(course.updateTime).toLocaleString()}</p> : null}
          {course.aliases.length > 0 ? <p className="muted">エイリアス: {course.aliases.join(", ")}</p> : null}
          {course.gradingPeriods.length > 0 ? (
            <div className="stack-sm">
              <strong>学期設定</strong>
              {course.gradingPeriods.map((period, index) => (
                <p className="muted" key={`${period.title}-${index}`}>
                  {period.title}
                  {period.startDate || period.endDate ? ` (${period.startDate ?? "?"} - ${period.endDate ?? "?"})` : ""}
                </p>
              ))}
            </div>
          ) : null}
          {course.alternateLink ? (
            <p>
              <a href={course.alternateLink} target="_blank" rel="noreferrer">
                Classroom でコースを開く
              </a>
            </p>
          ) : null}
        </section>
      ) : null}
      {course.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      {tab === "stream" ? <StreamTab stream={stream} /> : tab === "classwork" ? <ClassworkTab classwork={classwork} /> : <PeopleTab people={people} />}
    </section>
  );
}
