import { useEffect, useState } from "react";

export function Alert({ type = "error", children }) {
  const styles = {
    error: "alert-error",
    warning: "alert-warning",
    info: "alert-info",
    success: "alert-success",
  };
  return (
    <div role={type === "error" ? "alert" : "status"} className={styles[type]}>
      {children}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-900 border-t-transparent" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Shows stage labels one after another while a single long request is in progress. */
export function ProgressSteps({ steps, intervalMs = 1500 }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), intervalMs);
    return () => clearInterval(timer);
  }, [steps.length, intervalMs]);

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-900" />
      </div>
      <Spinner label={steps[index]} />
    </div>
  );
}

/** Two-step delete: the first click asks for confirmation, so nothing is removed by accident. */
export function ConfirmButton({ onConfirm, label = "Delete", confirmLabel = "Yes, delete", disabled, className = "btn-secondary" }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={disabled}>
        {label}
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-2 sm:flex-row">
      <button type="button" className="btn-danger" onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setAsking(false)} disabled={disabled}>
        Cancel
      </button>
    </span>
  );
}
