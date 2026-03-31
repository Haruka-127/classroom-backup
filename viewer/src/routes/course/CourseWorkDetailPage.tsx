import React from "react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { AttachmentList } from "../../components/AttachmentList";
import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import type { ViewerCourseWorkDetail } from "../../lib/types";

export function CourseWorkDetailPage() {
  const { courseId = "", courseWorkId = "" } = useParams();
  const [detail, setDetail] = useState<ViewerCourseWorkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void viewerApi
      .getCourseWork(decodeURIComponent(courseId), decodeURIComponent(courseWorkId))
      .then((response) => {
        if (!cancelled) {
          setDetail(response);
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
  }, [courseId, courseWorkId]);

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!detail) {
    return <p className="muted">Loading assignment...</p>;
  }

  return (
    <section className="stack-lg panel">
      <Link className="back-link" to={`/courses/${encodeURIComponent(detail.courseId)}?tab=classwork`}>
        Back to classwork
      </Link>
      <div className="stack-sm">
        <span className="pill">{detail.workType || "Course work"}</span>
        <h1>{detail.title}</h1>
        {detail.topicName ? <p className="muted">Topic: {detail.topicName}</p> : null}
        {detail.description ? <p>{detail.description}</p> : null}
      </div>
      {detail.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      <section className="stack-sm">
        <h2>Materials</h2>
        <AttachmentList attachments={detail.attachments} />
      </section>
      <section className="stack-sm">
        <h2>Your submission</h2>
        {detail.submission ? (
          <div className="stack-sm submission-panel">
            <p>State: {detail.submission.state || "Unknown"}</p>
            <p>{detail.submission.late ? "Marked late" : "Not marked late"}</p>
            {detail.submission.assignedGrade !== null ? <p>Assigned grade: {detail.submission.assignedGrade}</p> : null}
            {detail.submission.draftGrade !== null ? <p>Draft grade: {detail.submission.draftGrade}</p> : null}
            {detail.submission.shortAnswer ? <p>Short answer: {detail.submission.shortAnswer}</p> : null}
            {detail.submission.multipleChoiceAnswer ? <p>Multiple choice: {detail.submission.multipleChoiceAnswer}</p> : null}
            {detail.submission.notices.map((notice) => (
              <StateNotice key={notice.code} notice={notice} />
            ))}
            <AttachmentList attachments={detail.submission.attachments} />
          </div>
        ) : (
          <p className="muted">No saved submission snapshot for this coursework item.</p>
        )}
      </section>
    </section>
  );
}
