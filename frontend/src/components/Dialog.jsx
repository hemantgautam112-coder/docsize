/** A full-screen overlay. It sits above the whole page, so nothing behind it can be used until it closes. */
export default function Dialog({ labelledBy, wide = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6 ${wide ? "max-w-4xl" : "max-w-2xl"}`}
      >
        {children}
      </div>
    </div>
  );
}
