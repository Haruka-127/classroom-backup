import React from "react";
import { Link } from "react-router-dom";

import type { ViewerStreamResponse } from "../../lib/types";

interface StreamTabProps {
  stream: ViewerStreamResponse;
}

export function StreamTab({ stream }: StreamTabProps) {
  return (
    <div className="stack-md">
      {stream.items.map((item) => (
        <article className="stream-card" key={`${item.itemType}-${item.id}`}>
          <div className="stream-meta-row">
            <span className="pill">{item.itemType === "announcement" ? "Announcement" : item.workType || "Course work"}</span>
            {item.topicName ? <span className="muted">{item.topicName}</span> : null}
          </div>
          <h3>{item.title}</h3>
          {item.body ? <p>{item.body}</p> : null}
          <div className="stream-links">
            {item.detailPath ? <Link to={item.detailPath}>Open details</Link> : null}
            {item.alternateLink ? (
              <a href={item.alternateLink} target="_blank" rel="noreferrer">
                Open in Classroom
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
