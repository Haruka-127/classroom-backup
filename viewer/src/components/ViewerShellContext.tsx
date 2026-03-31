import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { viewerApi } from "../lib/api";
import type { ViewerCourseCard } from "../lib/types";

interface ViewerShellContextValue {
  courses: ViewerCourseCard[];
  currentCourseId: string | null;
}

const ViewerShellContext = createContext<ViewerShellContextValue>({
  courses: [],
  currentCourseId: null,
});

export function ViewerShellProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [courses, setCourses] = useState<ViewerCourseCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    void viewerApi.getCourses().then((response) => {
      if (!cancelled) {
        setCourses(response.courses);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const match = location.pathname.match(/^\/courses\/([^/]+)/);
  const currentCourseId = match ? decodeURIComponent(match[1] ?? "") : null;

  return <ViewerShellContext.Provider value={{ courses, currentCourseId }}>{children}</ViewerShellContext.Provider>;
}

export function useViewerShell() {
  return useContext(ViewerShellContext);
}
