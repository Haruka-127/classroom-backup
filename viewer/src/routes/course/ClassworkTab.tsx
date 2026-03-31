import React from "react";
import { Link } from "react-router-dom";

import { formatWorkTypeLabel } from "../../lib/labels";
import type { ViewerClassworkResponse } from "../../lib/types";

interface ClassworkTabProps {
  classwork: ViewerClassworkResponse;
}

export function ClassworkTab({ classwork }: ClassworkTabProps) {
  return (
    <div className="stack-lg classwork-layout">
      {classwork.sections.map((section) => (
        <details className="topic-section" key={section.topicId ?? "no-topic"} open>
          <summary>{section.topicName}</summary>
          <div className="stack-md topic-items">
            {section.items.map((item) => (
              <Link className="topic-item" key={`${item.itemType}-${item.id}`} to={item.detailPath}>
                <div>
                  <strong>{item.title}</strong>
                  {item.description ? <p className="muted">{item.description}</p> : null}
                </div>
                <span className="pill">{item.itemType === "course_work" ? formatWorkTypeLabel(item.workType) : "教材"}</span>
              </Link>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
