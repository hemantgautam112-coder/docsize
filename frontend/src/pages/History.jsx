import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/endpoints.js";
import { Alert, ConfirmButton, Spinner } from "../components/ui.jsx";
import { saveBlob } from "../lib/download.js";
import { formatDateTime, formatKB, isPast, isPdfMime } from "../lib/format.js";

export default function History() {
  const [items, setItems] = useState(null);
  const [documentNames, setDocumentNames] = useState({});
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openPreview, setOpenPreview] = useState(null); // { id, url, isPdf }

  useEffect(() => {
    Promise.all([api.listDerived(), api.listDocuments()])
      .then(([derived, documents]) => {
        setItems(derived);
        setDocumentNames(Object.fromEntries(documents.map((doc) => [doc.id, doc.original_filename])));
      })
      .catch((err) => setError(err.message));
  }, []);

  // Release the preview's object URL when it closes or changes.
  useEffect(() => {
    return () => {
      if (openPreview?.url) URL.revokeObjectURL(openPreview.url);
    };
  }, [openPreview]);

  async function handleDownload(item) {
    setBusyId(item.id);
    setError(null);
    try {
      saveBlob(await api.derivedFileBlob(item.id), item.download_name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function togglePreview(item) {
    if (openPreview?.id === item.id) {
      setOpenPreview(null);
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      const blob = await api.derivedFileBlob(item.id);
      setOpenPreview({ id: item.id, url: URL.createObjectURL(blob), isPdf: isPdfMime(item.mime_type) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item) {
    setBusyId(item.id);
    setError(null);
    try {
      await api.deleteDerived(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      if (openPreview?.id === item.id) setOpenPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Processed copies</h1>
        <p className="text-sm text-slate-600">
          Download any copy again at any time. Copies are deleted automatically after 30 days.
        </p>
      </section>

      {error && <Alert>{error}</Alert>}
      {items === null && !error && <Spinner label="Loading history..." />}

      {items && items.length === 0 && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-700">Nothing processed yet.</p>
          <Link className="btn-primary" to="/process">Resize a file</Link>
        </div>
      )}

      <ul className="space-y-4">
        {items?.map((item) => {
          const expired = isPast(item.expires_at);
          const isOpen = openPreview?.id === item.id;
          return (
            <li key={item.id} className="card space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all font-semibold text-slate-900">{item.download_name}</p>
                  <p className="text-sm text-slate-600">
                    From {documentNames[item.original_id] ?? "a file you uploaded"} · {formatKB(item.size_bytes)} · Created {formatDateTime(item.created_at)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {expired ? "Expired" : `Available until ${formatDateTime(item.expires_at)}`}
                  </p>
                </div>
                <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.target_met ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>
                  {item.target_met ? `Within ${item.report.target_kb} KB` : `Above ${item.report.target_kb} KB target`}
                </span>
              </div>

              {expired ? (
                <Alert type="warning">This copy has expired. Process the original again to create a new one.</Alert>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button type="button" className="btn-secondary" onClick={() => togglePreview(item)} disabled={busyId === item.id}>
                    {isOpen ? "Hide preview" : "Preview"}
                  </button>
                  <button type="button" className="btn-primary" onClick={() => handleDownload(item)} disabled={busyId === item.id}>
                    Download
                  </button>
                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Yes, delete copy"
                    disabled={busyId === item.id}
                    onConfirm={() => handleDelete(item)}
                  />
                </div>
              )}

              {isOpen && (
                <div className="rounded-xl bg-slate-100 p-3">
                  {openPreview.isPdf ? (
                    <iframe title={`Preview of ${item.download_name}`} src={openPreview.url} className="h-[60vh] w-full rounded-md bg-white" />
                  ) : (
                    <img src={openPreview.url} alt={`Preview of ${item.download_name}`} className="mx-auto max-h-[60vh] max-w-full rounded-md bg-white object-contain" />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
