import { useEffect, useRef, useState } from "react";
import { api } from "../api/endpoints.js";
import { Alert, ConfirmButton, Spinner } from "../components/ui.jsx";
import DocumentsTable from "../components/DocumentsTable.jsx";
import TagUploadDialog from "../components/TagUploadDialog.jsx";
import ScanUploadDialog from "../components/ScanUploadDialog.jsx";
import PreviewDialog from "../components/PreviewDialog.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { saveBlob } from "../lib/download.js";
import { validateFile } from "../lib/format.js";
import { STRINGS } from "../strings.js";

export default function Vault() {
  const { logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [chosenFiles, setChosenFiles] = useState([]);
  const [fileProblems, setFileProblems] = useState([]);
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [uploadNotice, setUploadNotice] = useState(null);
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const [scanFile, setScanFile] = useState(null);

  const [busyId, setBusyId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

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

  function handleFilesPicked(event) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = ""; // allow picking the same files again later
    const valid = [];
    const problems = [];
    for (const file of picked) {
      const problem = validateFile(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
      else valid.push(file);
    }
    setChosenFiles(valid);
    setFileProblems(problems);
    setUploadNotice(null);
  }

  // The Scan button opens the phone camera. The photo is checked here, then the user chooses how to upload it.
  function handleScanPicked(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setFileProblems([`${file.name}: ${problem}`]);
      return;
    }
    setFileProblems([]);
    setUploadNotice(null);
    setScanFile(file);
  }

  // Uploads one file after another, so the progress count stays accurate and the server's limits are respected.
  async function uploadAll(items) {
    setReviewing(false);
    setUploadNotice(null);
    const failed = [];
    for (let index = 0; index < items.length; index += 1) {
      setProgress({ done: index, total: items.length });
      const { file, document_type, convert_to_pdf = false } = items[index];
      try {
        const created = await api.uploadDocument(file, document_type, convert_to_pdf);
        setDocuments((current) => [created, ...current]);
      } catch (err) {
        failed.push(`${file.name} (${err.message})`);
      }
    }
    setProgress(null);
    setChosenFiles([]);
    const uploaded = items.length - failed.length;
    setUploadNotice({
      type: failed.length ? "warning" : "success",
      text: failed.length
        ? `${uploaded} of ${items.length} uploaded. Not uploaded: ${failed.join("; ")}`
        : `${uploaded} ${uploaded === 1 ? "file" : "files"} uploaded. Your originals are stored unchanged.`,
    });
  }

  async function handleTagChange(doc, documentType) {
    setBusyId(doc.id);
    setError(null);
    try {
      const updated = await api.updateDocumentTag(doc.id, documentType);
      setDocuments((current) => current.map((item) => (item.id === doc.id ? updated : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
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

      <section className="card space-y-4" aria-label="Upload files">
        <div>
          <h2 className="text-lg font-semibold">Upload files</h2>
          <p className="text-sm text-slate-600">
            Select one or more files at once. You can tag each file before it uploads, or skip that and upload with the suggested tags.
          </p>
        </div>

        <input
          ref={fileInput}
          id="files"
          type="file"
          multiple
          className="sr-only"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={handleFilesPicked}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Scan a document with the camera"
          onChange={handleScanPicked}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()} disabled={progress !== null}>
            Choose files
          </button>
          <button type="button" className="btn-secondary" onClick={() => cameraInput.current?.click()} disabled={progress !== null}>
            Scan document
          </button>
          <span className="text-sm text-slate-600">
            {chosenFiles.length === 0 ? "No files chosen (JPG, PNG, or PDF, up to 10 MB each)" : `${chosenFiles.length} selected`}
          </span>
          <button
            type="button"
            className="btn-primary sm:ml-auto"
            onClick={() => setReviewing(true)}
            disabled={chosenFiles.length === 0 || progress !== null}
          >
            Tag and upload
          </button>
        </div>

        {fileProblems.map((problem) => (
          <Alert key={problem}>{problem}</Alert>
        ))}

        {progress && (
          <p className="text-sm font-medium text-blue-900" aria-live="polite">
            Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}...
          </p>
        )}

        {uploadNotice && <Alert type={uploadNotice.type === "success" ? "success" : "warning"}>{uploadNotice.text}</Alert>}
      </section>

      <section className="space-y-3" aria-label="Your files">
        <h2 className="text-lg font-semibold">Your files {documents.length > 0 && `(${documents.length})`}</h2>

        {loading && <Spinner label="Loading your files..." />}
        {error && <Alert>{error}</Alert>}

        {!loading && documents.length === 0 && (
          <p className="card text-sm text-slate-600">No files yet. Choose one or more files above to begin.</p>
        )}

        {documents.length > 0 && (
          <DocumentsTable
            documents={documents}
            busyId={busyId}
            onPreview={setPreviewDoc}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onTagChange={handleTagChange}
          />
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-slate-600">
          Deleting your account removes all your original files, processed copies, and records. This cannot be undone.
        </p>
        <DeleteAccountButton onDeleted={logout} />
      </section>

      {reviewing && (
        <TagUploadDialog
          files={chosenFiles}
          onCancel={() => setReviewing(false)}
          onConfirm={uploadAll}
        />
      )}

      {scanFile && (
        <ScanUploadDialog
          file={scanFile}
          onCancel={() => setScanFile(null)}
          onConfirm={(item) => {
            setScanFile(null);
            uploadAll([item]);
          }}
        />
      )}

      {previewDoc && <PreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
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
