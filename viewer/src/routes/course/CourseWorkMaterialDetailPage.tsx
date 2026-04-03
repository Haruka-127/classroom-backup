import React from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AttachmentList } from "../../components/AttachmentList";
import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import { formatPublicationStateLabel } from "../../lib/labels";
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
    return <p className="muted">教材を読み込み中...</p>;
  }

  return (
    <section className="stack-lg detail-page">
      <Link className="back-link" to={`/courses/${encodeURIComponent(detail.courseId)}?tab=classwork`}>
        授業に戻る
      </Link>
      <div className="stack-sm panel detail-header-card">
        <span className="pill">教材</span>
        <h1>{detail.title}</h1>
        {detail.topicName ? <p className="muted">トピック: {detail.topicName}</p> : null}
        {detail.description ? <p>{detail.description}</p> : null}
        {detail.state ? <p className="muted">状態: {formatPublicationStateLabel(detail.state)}</p> : null}
        {detail.updateTime ? <p className="muted">最終更新: {new Date(detail.updateTime).toLocaleString()}</p> : null}
        {detail.alternateLink ? (
          <p>
            <a href={detail.alternateLink} target="_blank" rel="noreferrer">
              Classroom で開く
            </a>
          </p>
        ) : null}
      </div>
      {detail.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      <section className="stack-sm">
        <h2>添付</h2>
        <AttachmentList attachments={detail.attachments} />
      </section>
    </section>
  );
}
