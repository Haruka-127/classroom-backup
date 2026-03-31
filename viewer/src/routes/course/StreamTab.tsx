import React from "react";
import { Link } from "react-router-dom";

import { formatWorkTypeLabel } from "../../lib/labels";
import type { ViewerStreamResponse } from "../../lib/types";

interface StreamTabProps {
  stream: ViewerStreamResponse;
}

export function StreamTab({ stream }: StreamTabProps) {
  return (
    <div className="stream-feed stream-feed-full stack-md">
      {stream.items.map((item) => (
        <article className="stream-card classroom-stream-card" key={`${item.itemType}-${item.id}`}>
          {item.authorName || item.createdTime || item.topicName ? (
            <div className="stream-entry-header">
              {item.authorName ? <div className="stream-entry-avatar">{item.authorName.slice(0, 1).toUpperCase()}</div> : null}
              <div className="stream-entry-meta">
                {item.authorName ? <strong>{item.authorName}</strong> : null}
                <div className="muted">
                  {item.createdTime ? new Date(item.createdTime).toLocaleDateString() : null}
                  {item.createdTime && item.topicName ? " · " : null}
                  {item.topicName ? item.topicName : null}
                </div>
              </div>
            </div>
          ) : null}
          <div className="stream-chip-row">
            <span className="pill">{item.itemType === "announcement" ? "お知らせ" : formatWorkTypeLabel(item.workType)}</span>
            {item.pointsLabel ? <span className="muted">{item.pointsLabel}</span> : null}
            {item.dueLabel ? <span className="muted">{item.dueLabel}</span> : null}
          </div>
          <h3 className="stream-title">{item.title}</h3>
          {item.body ? <p className="stream-body-copy">{item.body}</p> : null}
          {item.attachments.length > 0 ? (
            <div className="stream-attachment-grid">
              {item.attachments.map((attachment, index) => {
                const artifact = attachment.driveFile?.artifacts.find((entry) => entry.url) ?? null;
                const previewLabel = attachment.driveFile?.mimeType?.includes("pdf") ? "PDF" : attachment.driveFile?.mimeType ?? "FILE";

                return (
                  <article className="stream-attachment-card" key={`${attachment.title}-${index}`}>
                    <div className="stream-attachment-copy">
                      <strong>{attachment.title}</strong>
                      <span className="muted">{previewLabel}</span>
                    </div>
                    <div className="stream-attachment-preview">{previewLabel.slice(0, 3)}</div>
                    {artifact?.url ? (
                      <a href={artifact.url} target={artifact.openInNewTab ? "_blank" : undefined} rel={artifact.openInNewTab ? "noreferrer" : undefined}>
                        開く
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
          <div className="stream-links">
            {item.detailPath ? <Link to={item.detailPath}>詳細を表示</Link> : null}
            {item.alternateLink ? (
              <a href={item.alternateLink} target="_blank" rel="noreferrer">
                Classroom で開く
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
