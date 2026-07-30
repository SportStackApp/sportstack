import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      size: "flexible";
      appearance: "interaction-only";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string) => void;
  resetKey: number;
}

const LOCAL_TEST_SITE_KEY = "1x00000000000000000000AA";
const SCRIPT_ID = "cloudflare-turnstile-script";

export function TurnstileWidget({ onTokenChange, resetKey }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const siteKey = useMemo(() => {
    const configured = import.meta.env.VITE_UMPIRE_TURNSTILE_SITE_KEY as string | undefined;
    if (configured) return configured;
    if (
      [
        "localhost",
        "127.0.0.1",
        "dev.sportstackapp.com.au",
        "main.sportstackapp.com.au",
      ].includes(window.location.hostname)
    ) {
      return LOCAL_TEST_SITE_KEY;
    }
    return "";
  }, []);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;
    onTokenChange("");
    setFailed(false);

    if (!siteKey) {
      setLoading(false);
      setFailed(true);
      return;
    }

    const renderWidget = () => {
      if (cancelled || !container || !window.turnstile) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        action: "umpire-vote-submit",
        theme: "auto",
        size: "flexible",
        appearance: "interaction-only",
        callback: (token) => {
          setLoading(false);
          setFailed(false);
          onTokenChange(token);
        },
        "expired-callback": () => {
          onTokenChange("");
          setFailed(true);
        },
        "error-callback": () => {
          onTokenChange("");
          setLoading(false);
          setFailed(true);
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
      script.addEventListener(
        "error",
        () => {
          if (!cancelled) {
            setLoading(false);
            setFailed(true);
          }
        },
        { once: true },
      );
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      if (container) container.replaceChildren();
    };
  }, [onTokenChange, resetKey, siteKey]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-8 w-full" />
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Preparing the security check...
        </div>
      )}
      {failed && (
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>The security check is not ready. Refresh this page before submitting.</span>
        </div>
      )}
    </div>
  );
}
