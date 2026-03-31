import React from "react";
import type { ViewerAttachment } from "../lib/types";
import { StateNotice } from "./StateNotice";

interface AttachmentListProps {
  attachments: ViewerAttachment[];
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) {
    return <p className="muted">No saved attachments in this backup.</p>;
  }

  return (
    <div className="attachment-list">
      {attachments.map((attachment, index) => (
        <article className="attachment-card" key={`${attachment.driveFileId ?? attachment.linkUrl ?? attachment.title}-${index}`}>
          <div className="attachment-header">
            <h4>{attachment.title}</h4>
            <span className="pill">{attachment.attachmentType.replace(/_/g, " ")}</span>
          </div>
          {attachment.linkUrl ? (
            <a href={attachment.linkUrl} target="_blank" rel="noreferrer">
              Open original link
            </a>
          ) : null}
          {attachment.driveFile ? (
            <div className="artifact-links">
              <p className="muted">
                {attachment.driveFile.name}
                {attachment.driveFile.mimeType ? ` · ${attachment.driveFile.mimeType}` : ""}
              </p>
              {attachment.driveFile.artifacts.length > 0 ? (
                attachment.driveFile.artifacts.map((artifact) =>
                  artifact.url ? (
                    <a
                      key={`${artifact.artifactKind}-${artifact.relativePath}`}
                      href={artifact.url}
                      target={artifact.openInNewTab ? "_blank" : undefined}
                      rel={artifact.openInNewTab ? "noreferrer" : undefined}
                    >
                      {artifact.label}
                    </a>
                  ) : (
                    <span className="muted" key={`${artifact.artifactKind}-${artifact.relativePath}`}>
                      {artifact.label} ({artifact.status})
                    </span>
                  ),
                )
              ) : (
                <p className="muted">No local artifact was saved for this file.</p>
              )}
              {attachment.driveFile.notices.map((notice) => (
                <StateNotice key={`${attachment.driveFileId}-${notice.code}`} notice={notice} />
              ))}
            </div>
          ) : null}
          {attachment.notices.map((notice) => (
            <StateNotice key={`${attachment.title}-${notice.code}`} notice={notice} />
          ))}
        </article>
      ))}
    </div>
  );
}
