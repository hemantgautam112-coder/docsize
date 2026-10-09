import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { STRINGS } from "../strings.js";

const NAV_ITEMS = [
  { to: "/vault", label: "Vault" },
  { to: "/process", label: "Process" },
  { to: "/history", label: "History" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to={user ? "/vault" : "/login"} className="text-xl font-bold text-teal-800">
            {STRINGS.appName}
          </Link>
          {user && (
            <nav aria-label="Main" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? "bg-teal-50 text-teal-900" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button type="button" className="btn-secondary min-h-[40px] px-3 py-2 text-sm" onClick={handleLogout} disabled={busy}>
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 text-sm text-slate-600 sm:px-6">
        <p className="font-medium text-slate-800">{STRINGS.disclaimer}</p>
        <p>{STRINGS.sensitiveWarning}</p>
        <p className="flex flex-wrap gap-4">
          <Link className="underline hover:text-teal-800" to="/privacy">Privacy</Link>
          <Link className="underline hover:text-teal-800" to="/terms">Terms</Link>
        </p>
      </div>
    </footer>
  );
}
