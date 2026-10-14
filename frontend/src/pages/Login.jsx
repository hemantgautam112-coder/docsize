import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/endpoints.js";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import Logo from "../components/Logo.jsx";
import { Alert, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const CONSENT_MESSAGE = "Please accept the Privacy Policy and Terms before you sign up. Tick the box to continue.";

/** Small document icons for the header and the footer decoration. Purely decorative. */
function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
      <path d="M14 3v5h5M10 13h6M10 17h6" strokeLinecap="round" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Login() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // New visitors land on Sign up. Existing users switch to Log in.
  const [tab, setTab] = useState("signup");
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Assume mobile is on until the server says otherwise, so a failed options call doesn't hide it.
  const [mobileEnabled, setMobileEnabled] = useState(true);

  useEffect(() => {
    api
      .authOptions()
      .then((options) => setMobileEnabled(options.mobile_login_enabled))
      .catch(() => {});
  }, []);

  if (!loading && user) {
    return <Navigate to="/vault" replace />;
  }
  if (loading) {
    return <Spinner label="Checking your session..." />;
  }

  const isSignup = tab === "signup";

  function switchTab(next) {
    setTab(next);
    setStep("identifier");
    setCode("");
    setError(null);
    setNotice(null);
  }

  function goToNextPage() {
    navigate(location.state?.from ?? "/vault", { replace: true });
  }

  async function sendCode(event) {
    event.preventDefault();
    setError(null);
    if (isSignup && !consent) {
      setError(CONSENT_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const response = await api.requestOtp(identifier.trim(), tab, consent);
      setNotice(response.message);
      setStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const signedIn = await api.verifyOtp(identifier.trim(), code.trim(), tab, consent);
      setUser(signedIn);
      goToNextPage();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleCredential(credential) {
    setError(null);
    if (isSignup && !consent) {
      setError("Please accept the Privacy Policy and Terms before you sign up with Google. Tick the box to continue.");
      return;
    }
    setBusy(true);
    try {
      const signedIn = await api.googleSignIn(credential, tab, consent);
      setUser(signedIn);
      goToNextPage();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2 text-blue-900" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white">
            <DocumentIcon />
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-900 text-white">
            <ScanIcon />
          </span>
        </div>
      </header>

      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-3xl font-bold leading-tight text-slate-900">
          Let&apos;s start
          <br />
          <span className="text-blue-900">resizing</span>
        </h1>
        <p className="mt-2 text-sm text-slate-600">Please sign up or log in to continue.</p>

        <div role="tablist" aria-label="Sign up or log in" className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
          {[
            { value: "signup", label: "Sign up" },
            { value: "login", label: "Log in" },
          ].map((option) => (
            <button
              key={option.value}
              role="tab"
              type="button"
              aria-selected={tab === option.value}
              onClick={() => switchTab(option.value)}
              className={`min-h-[42px] rounded-full text-sm font-semibold transition ${
                tab === option.value ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {step === "identifier" && (
          <form className="mt-6 space-y-4" onSubmit={sendCode} aria-label={isSignup ? "Sign up" : "Log in"}>
            <div>
              <label className="sr-only" htmlFor="identifier">
                {mobileEnabled ? "Mobile number or email" : "Email address"}
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-900 focus-within:ring-2 focus-within:ring-blue-200">
                <span className="text-slate-400">
                  <MailIcon />
                </span>
                <input
                  id="identifier"
                  className="min-h-[52px] w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  type="text"
                  inputMode={mobileEnabled ? "text" : "email"}
                  autoComplete="username"
                  placeholder={mobileEnabled ? "Mobile number or email" : "Your email"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              {!mobileEnabled && (
                <p className="mt-2 text-xs text-slate-500">Mobile number login is coming soon. Please use your email address.</p>
              )}
            </div>

            {isSignup && (
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-blue-900"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I agree to the <Link className="font-medium text-blue-900 underline" to="/privacy">Privacy Policy</Link> and{" "}
                  <Link className="font-medium text-blue-900 underline" to="/terms">Terms</Link>. I understand HDVault is not an official government site.
                </span>
              </label>
            )}

            {error && <Alert>{error}</Alert>}

            <button
              type="submit"
              className="btn-primary min-h-[52px] rounded-xl text-base"
              disabled={busy || !identifier.trim() || (isSignup && !consent)}
            >
              {busy ? "Sending..." : isSignup ? "Sign Up" : "Log in"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form className="mt-6 space-y-4" onSubmit={verifyCode} aria-label="Enter your code">
            {notice && <Alert type="info">{notice}</Alert>}
            <div>
              <label className="label" htmlFor="code">6-digit code</label>
              <input
                id="code"
                className="input text-center text-2xl tracking-widest"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                The code expires in 5 minutes and allows 3 attempts. During local development, the code is printed in the backend server console.
              </p>
            </div>

            {error && <Alert>{error}</Alert>}

            <button type="submit" className="btn-primary min-h-[52px] rounded-xl text-base" disabled={busy || code.length !== 6}>
              {busy ? "Checking..." : isSignup ? "Verify and create account" : "Verify and log in"}
            </button>
            <button type="button" className="btn-secondary rounded-xl" onClick={() => switchTab(tab)}>
              Change email
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <GoogleSignInButton onCredential={handleGoogleCredential} />

        <p className="mt-6 text-center text-sm text-slate-600">
          {isSignup ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="font-semibold text-blue-900 underline"
            onClick={() => switchTab(isSignup ? "login" : "signup")}
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </section>

      <p className="text-center text-xs text-slate-500">
        HDVault is an independent tool, not affiliated with any government body.
      </p>
    </div>
  );
}
