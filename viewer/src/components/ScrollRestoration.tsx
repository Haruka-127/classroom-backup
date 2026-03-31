import React, { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const scrollPositions = new Map<string, number>();
const RESTORE_INTERVAL_MS = 16;
const RESTORE_TIMEOUT_MS = 2000;

function getLocationKey(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

export function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = getLocationKey(location.pathname, location.search);

  useEffect(() => {
    if (typeof window.history.scrollRestoration === "string") {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.set(key, window.scrollY);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [key]);

  useLayoutEffect(() => {
    const saved = scrollPositions.get(key);
    let timeoutId: number | null = null;

    const startedAt = Date.now();

    const restoreScroll = () => {
      if (navigationType !== "POP" || typeof saved !== "number") {
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      const maxScrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const targetTop = Math.min(saved, maxScrollable);
      window.scrollTo({ top: targetTop, behavior: "auto" });

      const hasReachedTarget = Math.abs(window.scrollY - targetTop) <= 1;
      const canReachOriginalTarget = maxScrollable >= saved;
      const hasTimedOut = Date.now() - startedAt >= RESTORE_TIMEOUT_MS;

      if ((canReachOriginalTarget && hasReachedTarget) || hasTimedOut) {
        return;
      }

      timeoutId = window.setTimeout(restoreScroll, RESTORE_INTERVAL_MS);
    };

    restoreScroll();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [key, navigationType]);

  return null;
}
