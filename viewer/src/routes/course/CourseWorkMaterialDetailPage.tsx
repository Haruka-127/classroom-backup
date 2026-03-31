import React from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AttachmentList } from "../../components/AttachmentList";
import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import type { ViewerCourseWorkMaterialDetail } from "../../lib/types";

export function CourseWorkMaterialDetailPage() {
  const { courseId = "", courseWorkMaterialId = "" } = useParams();
  const [detail, setDetail] = useState<ViewerCourseWorkMaterialDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void viewerApi
      .getCourseWorkMaterial(decodeURIComponent(courseId), decodeURIComponent(courseWorkMaterialId))
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
  }, [courseId, courseWorkMaterialId]);

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!detail) {
    return <p className="muted">Loading material...</p>;
  }

  return (
    <section className="stack-lg panel">
      <Link className="back-link" to={`/courses/${encodeURIComponent(detail.courseId)}?tab=classwork`}>
        Back to classwork
      </Link>
      <div className="stack-sm">
        <span className="pill">Material</span>
        <h1>{detail.title}</h1>
        {detail.topicName ? <p className="muted">Topic: {detail.topicName}</p> : null}
        {detail.description ? <p>{detail.description}</p> : null}
      </div>
      {detail.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      <section className="stack-sm">
        <h2>Attachments</h2>
        <AttachmentList attachments={detail.attachments} />
      </section>
    </section>
  );
}
