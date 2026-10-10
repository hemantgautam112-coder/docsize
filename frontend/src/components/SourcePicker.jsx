import { useRef, useState } from "react";
import { Alert, Spinner } from "./ui.jsx";
import { ACCEPTED_EXTENSIONS, DOCUMENT_TYPES, documentTypeLabel, formatKB, validateFile } from "../lib/format.js";

function matchesQuery(doc, query) {
  if (!query) return true;
  const haystack = `${doc.original_filename} ${documentTypeLabel(doc.document_type)}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Lets the user pick a file from their device or from files already in the Vault.
 * A device file is uploaded to the Vault first, so it is also kept there for later.
 */
export default function SourcePicker({ documents, selectedId, onSelect, onUpload, uploading, uploadError }) {
  const [query, setQuery] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingType, setPendingType] = useState("photo");
  const [localError, setLocalError] = useState(null);
  const fileInput = useRef(null);

  const visible = documents.filter((doc) => matchesQuery(doc, query));

  function handleFileChosen(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = ""; // allow choosing the same file again later
    const problem = validateFile(file);
    if (problem) {
      setLocalError(problem);
      setPendingFile(null);
      return;
    }
    setLocalError(null);
    setPendingFile(file);
  }

  async function handleUploadPending() {
    await onUpload(pendingFile, pendingType);
    setPendingFile(null);
  }

  return (
    <div className="space-y-3">
      <label className="label" htmlFor="file-search">1. Choose a file</label>

      <input
        id="file-search"
        type="search"
        className="input"
        aria-label="Search by file name or type"
        placeholder="Search by file name or type (for example: photo, signature, marksheet)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      <div role="listbox" aria-label="Files to process" className="max-h-72 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-300 bg-white">
        <button
          type="button"
          role="option"
          aria-selected={pendingFile !== null}
          onClick={() => fileInput.current?.click()}
          className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold text-teal-900 hover:bg-teal-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-lg text-white" aria-hidden="true">+</span>
          Choose a file from this device
        </button>

        {visible.map((doc) => (
          <button
            key={doc.id}
            type="button"
            role="option"
            aria-selected={doc.id === selectedId}
            onClick={() => {
              setPendingFile(null);
              onSelect(doc.id);
            }}
            className={`flex min-h-[48px] w-full flex-col px-4 py-3 text-left hover:bg-slate-50 ${
              doc.id === selectedId ? "bg-teal-50" : ""
            }`}
          >
            <span className="break-all font-medium text-slate-900">{doc.original_filename}</span>
            <span className="text-sm text-slate-600">
              {documentTypeLabel(doc.document_type)} · {formatKB(doc.size_bytes)}
            </span>
          </button>
        ))}

        {visible.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-500">
            {documents.length === 0
              ? "No files in your Vault yet. Choose a file from this device to start."
              : `No saved files match "${query}".`}
          </p>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept={ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        onChange={handleFileChosen}
        aria-label="Choose a file from this device"
      />

      {localError && <Alert>{localError}</Alert>}

      {pendingFile && (
        <div className="space-y-3 rounded-lg border border-teal-300 bg-teal-50 p-4">
          <p className="text-sm text-slate-800">
            <span className="font-semibold">{pendingFile.name}</span> ({formatKB(pendingFile.size)}) will be saved to your Vault and used for this copy.
          </p>
          <div>
            <label className="label" htmlFor="pending-type">What is this file?</label>
            <select id="pending-type" className="input" value={pendingType} onChange={(e) => setPendingType(e.target.value)}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          {uploadError && <Alert>{uploadError}</Alert>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-primary" onClick={handleUploadPending} disabled={uploading}>
              {uploading ? <Spinner label="Uploading..." /> : "Upload and use this file"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPendingFile(null)} disabled={uploading}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
