/** The HDVault logo: an orange ring with a dot, followed by the name in bold display lettering. */
export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="13" fill="none" stroke="#ED7631" strokeWidth="6" />
        <circle cx="18" cy="18" r="4" fill="#ED7631" />
      </svg>
      <span className="font-display text-2xl font-extrabold tracking-tight text-[#1f1f1f]">
        HD<span className="text-[#ED7631]">Vault</span>
      </span>
    </span>
  );
}
