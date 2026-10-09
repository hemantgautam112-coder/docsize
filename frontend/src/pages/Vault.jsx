import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/endpoints.js";
import { ConfirmButton, Alert, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { DOCUMENT_TYPES, documentSummary, documentTypeLabel, formatDateTime, formatKB, validateFile } from "../lib/format.js";
import { saveBlob } from "../lib/download.js";
import { STRINGS } from "../strings.js";

export default function Vault() {
  const { logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState("photo");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadNotice, setUploadNotice] = useState(null);
  const fileInput = useRef(null);

  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await api.listDocuments());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const problem = validateFile(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploadError(null);
    setUploadNotice(null);
    setUploading(true);
    try {
      const created = await api.uploadDocument(file, documentType);
      setDocuments((current) => [created, ...current]);
      setUploadNotice(`${file.name} was uploaded. Your original is stored unchanged.`);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc) {
    setBusyId(doc.id);
    setError(null);
    try {
      saveBlob(await api.originalFileBlob(doc.id), doc.original_filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(doc) {
    setBusyId(doc.id);
    setError(null);
    try {
      await api.deleteDocument(doc.id);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Your document vault</h1>
        <p className="text-sm text-slate-600">{STRINGS.originalsNote}</p>
        <Alert type="warning">{STRINGS.sensitiveWarning}</Alert>
      </section>

      <form className="card space-y-4" onSubmit={handleUpload} aria-label="Upload a document">
        <h2 className="text-lg font-semibold">Upload a file</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="document-type">What is this?</label>
            <select
              id="document-type"
              className="input"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="file">JPG, PNG, or PDF (up to 10 MB)</label>
            <input
              id="file"
              ref={fileInput}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-3 file:font-semibold file:text-teal-900"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {uploadError && <Alert>{uploadError}</Alert>}
        {uploadNotice && <Alert type="success">{uploadNotice}</Alert>}

        <button type="submit" className="btn-primary" disabled={uploading || !file}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>

      <section className="space-y-3" aria-label="Uploaded documents">
        <h2 className="text-lg font-semibold">Uploaded files</h2>

        {loading && <Spinner label="Loading your files..." />}
        {error && <Alert>{error}</Alert>}

        {!loading && documents.length === 0 && (
          <p className="card text-sm text-slate-600">No files yet. Upload a photo or signature to begin.</p>
        )}

        <ul className="grid gap-4 md:grid-cols-2">
          {documents.map((doc) => (
            <li key={doc.id} className="card space-y-3">
              <div>
                <p className="break-all font-semibold text-slate-900">{doc.original_filename}</p>
                <p className="text-sm text-slate-600">
                  {documentTypeLabel(doc.document_type)} · {formatKB(doc.size_bytes)}
                  {documentSummary(doc) && ` · ${documentSummary(doc)}`}
                </p>
                <p className="text-xs text-slate-500">
                  Uploaded {formatDateTime(doc.created_at)} · SHA-256 {doc.sha256.slice(0, 12)}…
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link className="btn-primary" to={`/process?document=${doc.id}`}>
                  Make a resized copy
                </Link>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleDownload(doc)}
                  disabled={busyId === doc.id}
                >
                  Download original
                </button>
                <ConfirmButton
                  label="Delete"
                  confirmLabel="Yes, delete original"
                  disabled={busyId === doc.id}
                  onConfirm={() => handleDelete(doc)}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-slate-600">
          Deleting your account removes all your original files, processed copies, and records. This cannot be undone.
        </p>
        <DeleteAccountButton onDeleted={logout} />
      </section>
    </div>
  );
}

function DeleteAccountButton({ onDeleted }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount();
      await onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <ConfirmButton
        label="Delete my account"
        confirmLabel="Yes, delete everything"
        disabled={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
