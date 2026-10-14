/** The HDVault wordmark: a navy document badge plus the name in bold display lettering. */
export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r="16" fill="#1e3a8a" />
        <rect x="10.5" y="8" width="13" height="18" rx="2.5" fill="#ffffff" />
        <path d="M13.5 14h7M13.5 18h7M13.5 22h4.5" stroke="#1e3a8a" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="font-display text-2xl font-extrabold tracking-tight text-blue-900">
        HD<span className="font-semibold text-blue-600">Vault</span>
      </span>
    </span>
  );
}
