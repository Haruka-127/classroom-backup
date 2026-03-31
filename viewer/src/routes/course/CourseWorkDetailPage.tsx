import React from "react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { AttachmentList } from "../../components/AttachmentList";
import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import { formatSubmissionStateLabel, formatWorkTypeLabel } from "../../lib/labels";
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
    return <p className="muted">課題を読み込み中...</p>;
  }

  return (
    <section className="stack-lg panel">
      <Link className="back-link" to={`/courses/${encodeURIComponent(detail.courseId)}?tab=classwork`}>
        授業に戻る
      </Link>
      <div className="stack-sm">
        <span className="pill">{formatWorkTypeLabel(detail.workType)}</span>
        <h1>{detail.title}</h1>
        {detail.topicName ? <p className="muted">トピック: {detail.topicName}</p> : null}
        {detail.description ? <p>{detail.description}</p> : null}
      </div>
      {detail.notices.map((notice) => (
        <StateNotice key={notice.code} notice={notice} />
      ))}
      <section className="stack-sm">
        <h2>教材</h2>
        <AttachmentList attachments={detail.attachments} />
      </section>
      <section className="stack-sm">
        <h2>提出状況</h2>
        {detail.submission ? (
          <div className="stack-sm submission-panel">
            <p>状態: {formatSubmissionStateLabel(detail.submission.state)}</p>
            <p>{detail.submission.late ? "遅延として記録されています" : "遅延の記録はありません"}</p>
            {detail.submission.assignedGrade !== null ? <p>採点: {detail.submission.assignedGrade}</p> : null}
            {detail.submission.draftGrade !== null ? <p>下書き点: {detail.submission.draftGrade}</p> : null}
            {detail.submission.shortAnswer ? <p>記述式の回答: {detail.submission.shortAnswer}</p> : null}
            {detail.submission.multipleChoiceAnswer ? <p>選択式の回答: {detail.submission.multipleChoiceAnswer}</p> : null}
            {detail.submission.notices.map((notice) => (
              <StateNotice key={notice.code} notice={notice} />
            ))}
            <AttachmentList attachments={detail.submission.attachments} />
          </div>
        ) : (
          <p className="muted">この課題の提出スナップショットは保存されていません。</p>
        )}
      </section>
    </section>
  );
}
