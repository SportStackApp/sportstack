import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    __sportstackOriginalFetch?: typeof fetch;
  }
}

const MIN_VISIBLE_MS = 350;

export const GlobalLoadingBar = () => {
  const location = useLocation();
  const [activeRequests, setActiveRequests] = useState(0);
  const [routeChanging, setRouteChanging] = useState(false);
  const [visible, setVisible] = useState(false);
  const visibleSince = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || window.__sportstackOriginalFetch) return;

    window.__sportstackOriginalFetch = window.fetch;

    window.fetch = async (...args) => {
      setActiveRequests((current) => current + 1);

      try {
        return await window.__sportstackOriginalFetch!(...args);
      } finally {
        setActiveRequests((current) => Math.max(0, current - 1));
      }
    };

    return () => {
      if (window.__sportstackOriginalFetch) {
        window.fetch = window.__sportstackOriginalFetch;
        delete window.__sportstackOriginalFetch;
      }
    };
  }, []);

  useEffect(() => {
    setRouteChanging(true);
    const timeout = window.setTimeout(() => setRouteChanging(false), 250);

    return () => window.clearTimeout(timeout);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const shouldShow = activeRequests > 0 || routeChanging;

    if (shouldShow) {
      visibleSince.current = Date.now();
      setVisible(true);
      return;
    }

    const elapsed = Date.now() - visibleSince.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const timeout = window.setTimeout(() => setVisible(false), delay);

    return () => window.clearTimeout(timeout);
  }, [activeRequests, routeChanging]);

  return (
    <div
      aria-hidden={!visible}
      aria-label="Loading"
      className={`fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/10 transition-opacity duration-150 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="h-full w-1/2 animate-loading-bar rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.55)]" />
    </div>
  );
};
