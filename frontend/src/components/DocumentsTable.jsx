import { Link } from "react-router-dom";
import { ConfirmButton } from "./ui.jsx";
import { DOCUMENT_TYPES, documentSummary, formatDateTime, formatKB } from "../lib/format.js";

const actionClass =
  "whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:text-slate-400";

const resizeClass =
  "whitespace-nowrap rounded-md bg-blue-700 px-3 py-1.5 text-center text-sm font-semibold text-white hover:bg-blue-800";

function TagSelect({ doc, busyId, onTagChange }) {
  return (
    <select
      aria-label={`Tag for ${doc.original_filename}`}
      className="w-full rounded-full border border-blue-300 bg-blue-50 px-2 py-1 text-sm font-semibold text-blue-900 disabled:opacity-60"
      value={doc.document_type}
      onChange={(e) => onTagChange(doc, e.target.value)}
      disabled={busyId === doc.id}
    >
      {DOCUMENT_TYPES.map((type) => (
        <option key={type.value} value={type.value}>{type.label}</option>
      ))}
    </select>
  );
}

/**
 * Desktop: one row per file, in a table.
 * Phones and tablets: one card per file, stacked. Nothing needs sideways scrolling, which avoids accidental back-swipes.
 */
export default function DocumentsTable({ documents, busyId, onPreview, onDownload, onDelete, onTagChange }) {
  return (
    <>
      {/* Phones and tablets: stacked cards */}
      <ul className="space-y-3 lg:hidden">
        {documents.map((doc) => (
          <li key={doc.id} className="card space-y-3">
            <p className="break-all font-semibold text-slate-900">{doc.original_filename}</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
              <span>Size: {formatKB(doc.size_bytes)}</span>
              <span>{documentSummary(doc) || "No dimensions"}</span>
              <span className="col-span-2">Uploaded {formatDateTime(doc.created_at)}</span>
            </div>
            <TagSelect doc={doc} busyId={busyId} onTagChange={onTagChange} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`${actionClass} w-full`} onClick={() => onPreview(doc)} disabled={busyId === doc.id}>
                Preview
              </button>
              <Link className={resizeClass} to={`/process?document=${doc.id}`}>Resize</Link>
              <button type="button" className={`${actionClass} w-full`} onClick={() => onDownload(doc)} disabled={busyId === doc.id}>
                Download
              </button>
              <ConfirmButton
                label="Delete"
                confirmLabel="Yes, delete"
                disabled={busyId === doc.id}
                onConfirm={() => onDelete(doc)}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Large screens: one row per file */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-[960px] table-fixed divide-y divide-slate-200 text-sm">
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "24%" }} />
          </colgroup>
          <thead className="bg-blue-900 text-left text-xs font-semibold uppercase tracking-wide text-white">
            <tr>
              <th scope="col" className="px-4 py-3">File name</th>
              <th scope="col" className="px-4 py-3">Tag</th>
              <th scope="col" className="px-4 py-3">Size</th>
              <th scope="col" className="px-4 py-3">Dimensions / pages</th>
              <th scope="col" className="px-4 py-3">Uploaded</th>
              <th scope="col" className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc, index) => (
              <tr key={doc.id} className={`align-middle ${index % 2 === 1 ? "bg-slate-50" : "bg-white"} hover:bg-blue-50/40`}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={doc.original_filename}>
                    {doc.original_filename}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <TagSelect doc={doc} busyId={busyId} onTagChange={onTagChange} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">{formatKB(doc.size_bytes)}</td>
                <td className="whitespace-nowrap px-4 py-3">{documentSummary(doc) || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(doc.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-nowrap items-center gap-2">
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
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
