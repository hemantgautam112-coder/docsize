import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "../config.js";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("The security check could not load. Check your connection."));
    document.head.appendChild(script);
  });
}

/**
 * Cloudflare Turnstile: a free check that tells people from scripts. onToken receives the token, or null
 * when the check has not passed yet. Changing resetKey asks for a fresh check (tokens are used once).
 */
export default function Turnstile({ onToken, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      onTokenRef.current("");
      return undefined;
    }
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current !== null) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || resetKey === 0) return;
    if (window.turnstile && widgetId.current !== null) window.turnstile.reset(widgetId.current);
    onTokenRef.current(null);
  }, [resetKey]);

  return <div ref={containerRef} className="flex justify-center" />;
}
