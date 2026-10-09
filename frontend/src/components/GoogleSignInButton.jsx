import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "../config.js";

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Google sign-in. Check your connection."));
    document.head.appendChild(script);
  });
}

/**
 * Renders Google's official sign-in button. Google gives the browser an ID token, which is
 * passed to onCredential. The backend verifies it. The browser's claim is never trusted.
 */
export default function GoogleSignInButton({ onCredential }) {
  const containerRef = useRef(null);
  const handlerRef = useRef(onCredential);
  const [error, setError] = useState(null);

  // Keep the latest handler, so the button always uses the current tab and consent state.
  handlerRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => handlerRef.current?.(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 320,
        });
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="alert-info">
        Google sign-in is not set up yet. Add VITE_GOOGLE_CLIENT_ID to frontend/.env.local and restart the dev server.
      </p>
    );
  }
  if (error) return <p className="alert-error">{error}</p>;
  return <div ref={containerRef} className="flex justify-center" />;
}
