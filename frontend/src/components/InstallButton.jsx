import { useEffect, useState } from "react";

/** True when the app is already running from the home screen. */
function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

/** True on iPhone and iPad Safari, which has no install button and needs a manual step. */
function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

/**
 * Lets the user add HDVault to their home screen.
 * On Android and desktop Chrome, a real install button is shown. On iPhone, a short how-to is shown instead.
 */
export default function InstallButton() {
  const [installEvent, setInstallEvent] = useState(() => window.__deferredInstallPrompt ?? null);
  const [installed, setInstalled] = useState(isInstalled());
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    function handlePrompt(event) {
      event.preventDefault();
      window.__deferredInstallPrompt = event;
      setInstallEvent(event);
    }
    function handleInstalled() {
      window.__deferredInstallPrompt = null;
      setInstalled(true);
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) return null;

  if (installEvent) {
    return (
      <button
        type="button"
        className="btn-secondary min-h-[40px] px-3 py-2 text-sm"
        onClick={async () => {
          installEvent.prompt();
          await installEvent.userChoice;
          setInstallEvent(null);
        }}
      >
        Install app
      </button>
    );
  }

  if (isIosSafari()) {
    return (
      <div className="w-full text-sm text-slate-700">
        <button type="button" className="btn-secondary min-h-[40px] px-3 py-2 text-sm" onClick={() => setShowIosHelp((v) => !v)}>
          Add to Home Screen
        </button>
        {showIosHelp && (
          <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            Tap the Share button at the bottom of Safari, then choose <span className="font-semibold">Add to Home Screen</span>.
          </p>
        )}
      </div>
    );
  }

  return null;
}
