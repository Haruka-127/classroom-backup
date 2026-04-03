import React from "react";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { AttachmentList } from "../../components/AttachmentList";
import { StateNotice } from "../../components/StateNotice";
import { viewerApi } from "../../lib/api";
import { formatPublicationStateLabel, formatSubmissionStateLabel, formatWorkTypeLabel } from "../../lib/labels";
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
    <section className="stack-lg detail-page">
      <Link className="back-link" to={`/courses/${encodeURIComponent(detail.courseId)}?tab=classwork`}>
        授業に戻る
      </Link>
      <div className="stack-sm panel detail-header-card">
        <span className="pill">{formatWorkTypeLabel(detail.workType)}</span>
        <h1>{detail.title}</h1>
        {detail.topicName ? <p className="muted">トピック: {detail.topicName}</p> : null}
        {detail.description ? <p>{detail.description}</p> : null}
        {detail.state ? <p className="muted">状態: {formatPublicationStateLabel(detail.state)}</p> : null}
        {detail.pointsLabel ? <p className="muted">配点: {detail.pointsLabel}</p> : null}
        {detail.dueLabel ? <p className="muted">{detail.dueLabel}</p> : null}
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
        <h2>評価基準</h2>
        {detail.rubrics.length > 0 ? (
          <div className="stack-md">
            {detail.rubrics.map((rubric) => (
              <article className="panel stack-sm" key={rubric.rubricId}>
                <strong>{rubric.title}</strong>
                {rubric.criteria.map((criterion) => (
                  <div className="stack-sm" key={criterion.criterionId}>
                    <div>
                      <strong>{criterion.title}</strong>
                      {criterion.description ? <p className="muted">{criterion.description}</p> : null}
                    </div>
                    {criterion.levels.length > 0 ? (
                      <div className="people-chip-row">
                        {criterion.levels.map((level) => (
                          <span className="pill" key={level.levelId}>
                            {level.title}
                            {level.points !== null ? ` (${level.points})` : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">評価基準は保存されていません。</p>
        )}
      </section>
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
            {detail.submission.updateTime ? <p>最終更新: {new Date(detail.submission.updateTime).toLocaleString()}</p> : null}
            {detail.submission.shortAnswer ? <p>記述式の回答: {detail.submission.shortAnswer}</p> : null}
            {detail.submission.multipleChoiceAnswer ? <p>選択式の回答: {detail.submission.multipleChoiceAnswer}</p> : null}
            {detail.submission.alternateLink ? (
              <p>
                <a href={detail.submission.alternateLink} target="_blank" rel="noreferrer">
                  Classroom の提出物を開く
                </a>
              </p>
            ) : null}
            {detail.submission.notices.map((notice) => (
              <StateNotice key={notice.code} notice={notice} />
            ))}
            <AttachmentList attachments={detail.submission.attachments} />
            <div className="stack-sm">
              <h3>提出履歴</h3>
              {detail.submission.history.length > 0 ? (
                <div className="stack-sm">
                  {detail.submission.history.map((entry) => (
                    <article className="history-entry" key={entry.entryId}>
                      <strong>{entry.title}</strong>
                      {entry.actorName ? <p className="muted">実行者: {entry.actorName}</p> : null}
                      {entry.timestamp ? <p className="muted">{new Date(entry.timestamp).toLocaleString()}</p> : null}
                      {entry.description ? <p className="muted">{entry.description}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">提出履歴は保存されていません。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="muted">この課題の提出スナップショットは保存されていません。</p>
        )}
      </section>
    </section>
  );
}
