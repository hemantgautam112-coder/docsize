import { Link } from "react-router-dom";
import { ConfirmButton } from "./ui.jsx";
import { DOCUMENT_TYPES, documentSummary, formatDateTime, formatKB } from "../lib/format.js";

// All four action buttons share one size and alignment, so they look even in each card.
const actionBase =
  "inline-flex min-h-[44px] w-full items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-center text-sm font-semibold";

const actionClass = `${actionBase} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:text-slate-400`;

const resizeClass = `${actionBase} bg-blue-900 text-white hover:bg-blue-950`;

/**
 * One card per file, in the same layout on every screen size.
 * One column on phones, two on tablets, and three on laptops and larger screens.
 */
export default function DocumentsTable({ documents, busyId, onPreview, onDownload, onDelete, onTagChange }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {documents.map((doc) => (
        <li key={doc.id} className="card flex flex-col gap-3">
          <p className="break-all font-semibold text-slate-900">{doc.original_filename}</p>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600">
            <span>Size: {formatKB(doc.size_bytes)}</span>
            <span>{documentSummary(doc) || "No dimensions"}</span>
            <span className="col-span-2">Uploaded {formatDateTime(doc.created_at)}</span>
          </div>

          <select
            aria-label={`Tag for ${doc.original_filename}`}
            className="w-full rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900 disabled:opacity-60"
            value={doc.document_type}
            onChange={(e) => onTagChange(doc, e.target.value)}
            disabled={busyId === doc.id}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <div className="mt-auto grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" className={actionClass} onClick={() => onPreview(doc)} disabled={busyId === doc.id}>
              Preview
            </button>
            <Link className={resizeClass} to={`/process?document=${doc.id}`}>Resize</Link>
            <button type="button" className={actionClass} onClick={() => onDownload(doc)} disabled={busyId === doc.id}>
              Download
            </button>
            <ConfirmButton
              label="Delete"
              confirmLabel="Yes, delete"
              disabled={busyId === doc.id}
              onConfirm={() => onDelete(doc)}
              className={actionClass}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
