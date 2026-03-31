import React from "react";
import type { ViewerStateNotice } from "../lib/types";

interface StateNoticeProps {
  notice: ViewerStateNotice;
}

export function StateNotice({ notice }: StateNoticeProps) {
  return (
    <div className={`notice notice-${notice.tone}`} role="status">
      <strong>{notice.title}</strong>
      <p>{notice.description}</p>
    </div>
  );
}
