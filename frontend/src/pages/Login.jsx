import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/endpoints.js";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import Turnstile from "../components/Turnstile.jsx";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Spinner } from "../components/ui.jsx";

const CONSENT_MESSAGE = "Please accept the Privacy Policy and Terms before you sign up. Tick the box to continue.";
const GOOGLE_CONSENT_MESSAGE = "Please accept the Privacy Policy and Terms before you sign up with Google. Tick the box, then try again.";

/* Icons used on the page, drawn to match the reference design. */
function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#696D70" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
      <path d="M14 3v5h5M10 13h6M10 17h6" strokeLinecap="round" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
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
  const [googleError, setGoogleError] = useState(null);
  const [consentHighlight, setConsentHighlight] = useState(false);
  const [notice, setNotice] = useState(null);
  // The security check token. null means the check has not passed yet. Each request uses a fresh check.
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaKey, setCaptchaKey] = useState(0);
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
    setGoogleError(null);
    setConsentHighlight(false);
    setNotice(null);
  }

  function goToNextPage() {
    navigate(location.state?.from ?? "/vault", { replace: true });
  }

  function refuseWithoutConsent(message, setMessage) {
    setMessage(message);
    setConsentHighlight(true);
  }

  async function sendCode(event) {
    event.preventDefault();
    setError(null);
    if (isSignup && !consent) {
      refuseWithoutConsent(CONSENT_MESSAGE, setError);
      return;
    }
    if (captchaToken === null) {
      setError("Please complete the security check first.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.requestOtp(identifier.trim(), tab, consent, captchaToken);
      setNotice(response.message);
      setStep("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      // Tokens are single-use, so the next attempt needs a fresh check.
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
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
    setGoogleError(null);
    if (isSignup && !consent) {
      refuseWithoutConsent(GOOGLE_CONSENT_MESSAGE, setGoogleError);
      return;
    }
    setBusy(true);
    try {
      const signedIn = await api.googleSignIn(credential, tab, consent);
      setUser(signedIn);
      goToNextPage();
    } catch (err) {
      setGoogleError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const heading = isSignup ? "Sign Up" : "Login";

  return (
    <div className="min-h-screen bg-[#E3E3E3] sm:p-6">
      <div className="mx-auto flex min-h-screen max-w-[1120px] flex-col rounded-none bg-[#F7F5F4] px-5 py-6 sm:min-h-[calc(100vh-3rem)] sm:rounded-[28px] sm:px-10 sm:py-8">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#A3A7AF] bg-transparent">
              <DocumentIcon color="#222222" />
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#222222]">
              <ScanIcon />
            </span>
          </div>
        </header>

        <main className="relative mx-auto flex w-full flex-1 items-center justify-center py-8">
          <img
            src="/images/login-left.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-6 left-0 hidden w-[330px] select-none md:block"
          />
          <img
            src="/images/login-right.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-6 right-0 hidden w-[340px] select-none md:block"
          />

          <section className="relative z-10 w-full max-w-[460px] rounded-[22px] bg-white px-7 py-9 shadow-[0_6px_30px_rgba(0,0,0,0.04)] sm:px-10">
            <h1 className="font-display text-[32px] font-bold leading-[1.15] text-[#323232]">
              Lets
              <br />
              Start Resizing
            </h1>
            <p className="mt-2 text-[15px] text-[#696D70]">Please login or sign up to continue</p>

            {step === "identifier" && (
              <form className="mt-7 space-y-4" onSubmit={sendCode} aria-label={heading}>
                <div>
                  <label className="sr-only" htmlFor="identifier">
                    {mobileEnabled ? "Mobile number or email" : "Email address"}
                  </label>
                  <div className="flex h-[54px] items-center gap-3 rounded-xl border border-[#E8E6E7] bg-[#F7F5F4] px-4 focus-within:border-[#ED7631] focus-within:ring-2 focus-within:ring-[#ED7631]/20">
                    <MailIcon />
                    <input
                      id="identifier"
                      className="h-full w-full bg-transparent text-[16px] text-[#323232] placeholder:text-[#8F9396] focus:outline-none"
                      type="text"
                      inputMode={mobileEnabled ? "text" : "email"}
                      autoComplete="username"
                      placeholder={mobileEnabled ? "Your Email or Mobile" : "Your Email"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                    />
                  </div>
                  {!mobileEnabled && (
                    <p className="mt-2 text-xs text-[#696D70]">Mobile number login is coming soon. Please use your email address.</p>
                  )}
                </div>

                {isSignup && (
                  <label
                    className={`flex items-start gap-3 rounded-xl p-2 text-[13px] leading-snug text-[#525659] ${
                      consentHighlight && !consent ? "ring-2 ring-[#E5484D]" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#ED7631]"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        if (e.target.checked) {
                          setConsentHighlight(false);
                          setError(null);
                          setGoogleError(null);
                        }
                      }}
                    />
                    <span>
                      I agree to the <Link className="font-semibold text-[#323232] underline" to="/privacy">Privacy Policy</Link> and{" "}
                      <Link className="font-semibold text-[#323232] underline" to="/terms">Terms</Link>. HDVault is not an official government site.
                    </span>
                  </label>
                )}

                <Turnstile onToken={setCaptchaToken} resetKey={captchaKey} />

                {error && (
                  <p role="alert" className="rounded-xl border border-[#E5484D]/30 bg-[#FDECEC] px-4 py-3 text-sm text-[#B42318]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="flex h-[54px] w-full items-center justify-center rounded-xl bg-[#ED7631] text-[16px] font-semibold text-white transition hover:bg-[#E0692A] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busy || !identifier.trim() || captchaToken === null}
                >
                  {busy ? "Sending..." : isSignup ? "Sign Up" : "Login"}
                </button>
              </form>
            )}

            {step === "code" && (
              <form className="mt-7 space-y-4" onSubmit={verifyCode} aria-label="Enter your code">
                {notice && <p className="rounded-xl bg-[#F7F5F4] px-4 py-3 text-sm text-[#525659]">{notice}</p>}
                <label className="sr-only" htmlFor="code">6-digit code</label>
                <input
                  id="code"
                  className="h-[54px] w-full rounded-xl border border-[#E8E6E7] bg-[#F7F5F4] text-center font-display text-2xl tracking-[0.4em] text-[#323232] focus:border-[#ED7631] focus:outline-none focus:ring-2 focus:ring-[#ED7631]/20"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
                <p className="text-xs text-[#696D70]">
                  The code expires in 5 minutes and allows 3 attempts. During local development, the code is printed in the backend server console.
                </p>

                {error && (
                  <p role="alert" className="rounded-xl border border-[#E5484D]/30 bg-[#FDECEC] px-4 py-3 text-sm text-[#B42318]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="flex h-[54px] w-full items-center justify-center rounded-xl bg-[#ED7631] text-[16px] font-semibold text-white transition hover:bg-[#E0692A] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? "Checking..." : isSignup ? "Verify and create account" : "Verify and login"}
                </button>
                <button type="button" className="w-full text-sm font-semibold text-[#323232] underline" onClick={() => switchTab(tab)}>
                  Change email
                </button>
              </form>
            )}

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-[#A3A7AF]" aria-hidden="true">
              <span className="h-px flex-1 bg-[#E8E6E7]" />
              or
              <span className="h-px flex-1 bg-[#E8E6E7]" />
            </div>

            <div className="relative">
              <div className="flex justify-center rounded-xl border border-[#E8E6E7] bg-white py-1">
                <GoogleSignInButton onCredential={handleGoogleCredential} />
              </div>
              {/* Until the user accepts the privacy policy, clicks on Google show the warning instead of opening Google. */}
              {isSignup && !consent && (
                <button
                  type="button"
                  aria-label="Accept the Privacy Policy first to sign up with Google"
                  className="absolute inset-0 z-10 cursor-pointer rounded-xl bg-white/50"
                  onClick={() => refuseWithoutConsent(GOOGLE_CONSENT_MESSAGE, setGoogleError)}
                />
              )}
            </div>
            {googleError && (
              <p role="alert" className="mt-3 rounded-xl border border-[#E5484D]/30 bg-[#FDECEC] px-4 py-3 text-sm text-[#B42318]">
                {googleError}
              </p>
            )}

            <p className="mt-7 text-center text-[14px] text-[#696D70]">
              {isSignup ? "Already Have An Account? " : "New Here? "}
              <button
                type="button"
                className="font-semibold text-[#323232] underline"
                onClick={() => switchTab(isSignup ? "login" : "signup")}
              >
                {isSignup ? "Login" : "Sign Up"}
              </button>
            </p>
          </section>
        </main>

        <footer className="pt-4 text-center text-xs text-[#696D70]">
          HDVault is an independent tool. It is not affiliated with any government body or exam conducting authority.
        </footer>
      </div>
    </div>
  );
}
