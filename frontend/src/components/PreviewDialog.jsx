import { useEffect, useState } from "react";
import Dialog from "./Dialog.jsx";
import { Alert, Spinner } from "./ui.jsx";
import { api } from "../api/endpoints.js";

/**
 * Shows the original file. It covers the whole page until the user clicks Close.
 * Clicking outside the dialog does not close it, so the user can't lose track of the preview.
 */
export default function PreviewDialog({ doc, onClose }) {
  const [url, setUrl] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    api
      .originalFileBlob(doc.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setMimeType(blob.type || doc.mime_type);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, doc.mime_type]);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isPdf = (mimeType || doc.mime_type) === "application/pdf";

  return (
    <Dialog labelledBy="preview-title" wide>
      <div className="min-w-0">
        <h2 id="preview-title" className="break-all text-lg font-bold text-slate-900">Preview: {doc.original_filename}</h2>
        <p className="text-sm text-slate-600">This is your original file. Viewing it does not change it.</p>
      </div>

      <div className="mt-4 flex min-h-[40vh] items-center justify-center rounded-lg bg-slate-100 p-3">
        {error && <Alert>{error}</Alert>}
        {!error && !url && <Spinner label="Loading preview..." />}
        {url && !isPdf && (
          <img src={url} alt={`Preview of ${doc.original_filename}`} className="max-h-[60vh] max-w-full rounded-md bg-white object-contain" />
        )}
        {url && isPdf && <iframe title={`Preview of ${doc.original_filename}`} src={url} className="h-[60vh] w-full rounded-md bg-white" />}
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" className="btn-primary" onClick={onClose}>Close preview</button>
      </div>
    </Dialog>
  );
}
