import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/endpoints.js";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import { Alert, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const TABS = {
  login: {
    heading: "Log in",
    intro: "Log in to your existing account with a one-time code or Google.",
    cta: "Send code",
  },
  signup: {
    heading: "Create your account",
    intro: "New here? Sign up with your mobile number or email, or with Google. You only need to do this once.",
    cta: "Send code to sign up",
  },
};

export default function Login() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState("login");
  const [step, setStep] = useState("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  if (!loading && user) {
    return <Navigate to="/vault" replace />;
  }
  if (loading) {
    return <Spinner label="Checking your session..." />;
  }

  const isSignup = tab === "signup";
  const copy = TABS[tab];

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
      setError("Tick the box to agree to the Privacy Policy and Terms before you sign up.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.requestOtp(identifier.trim(), tab);
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
      setError("Tick the box to agree to the Privacy Policy and Terms before you sign up with Google.");
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
    <div className="mx-auto max-w-md space-y-6">
      <div role="tablist" aria-label="Log in or sign up" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-200 p-1">
        {["login", "signup"].map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={tab === name}
            onClick={() => switchTab(name)}
            className={`min-h-[44px] rounded-lg text-base font-semibold ${
              tab === name ? "bg-white text-teal-900 shadow-sm" : "text-slate-600"
            }`}
          >
            {name === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <section className="card space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">{copy.heading}</h1>
        <p className="text-sm text-slate-600">{copy.intro}</p>
      </section>

      {step === "identifier" && (
        <form className="card space-y-4" onSubmit={sendCode} aria-label={copy.heading}>
          <div>
            <label className="label" htmlFor="identifier">Mobile number or email</label>
            <input
              id="identifier"
              className="input"
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder="98765 43210 or you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          {isSignup && (
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I agree to the <Link className="underline" to="/privacy">Privacy Policy</Link> and{" "}
                <Link className="underline" to="/terms">Terms</Link>. I understand DocSize is not an official government site.
              </span>
            </label>
          )}

          {error && <Alert>{error}</Alert>}

          <button type="submit" className="btn-primary" disabled={busy || !identifier.trim() || (isSignup && !consent)}>
            {busy ? "Sending..." : copy.cta}
          </button>
        </form>
      )}

      {step === "code" && (
        <form className="card space-y-4" onSubmit={verifyCode} aria-label="Enter your code">
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

          <button type="submit" className="btn-primary" disabled={busy || code.length !== 6}>
            {busy ? "Checking..." : isSignup ? "Verify and create account" : "Verify and log in"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => switchTab(tab)}>
            Change number or email
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-300" />
        or
        <span className="h-px flex-1 bg-slate-300" />
      </div>

      <section className="card space-y-3">
        <p className="text-sm font-medium text-slate-700">{isSignup ? "Sign up with Google" : "Log in with Google"}</p>
        <GoogleSignInButton onCredential={handleGoogleCredential} />
        <p className="text-xs text-slate-500">
          {isSignup
            ? "Google shares only your verified email address with DocSize."
            : "Use the Google account you signed up with. If you have not signed up yet, use the Sign up tab first."}
        </p>
      </section>
    </div>
  );
}
