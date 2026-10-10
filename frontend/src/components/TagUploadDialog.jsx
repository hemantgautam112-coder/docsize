import { useState } from "react";
import Dialog from "./Dialog.jsx";
import { DOCUMENT_TYPES, formatKB, suggestTag } from "../lib/format.js";

/**
 * Asks for a tag for each selected file. Each file starts with a suggested tag from its name,
 * so clicking Upload straight away is fine.
 */
export default function TagUploadDialog({ files, onCancel, onConfirm }) {
  const [tags, setTags] = useState(() =>
    Object.fromEntries(files.map((file, index) => [index, suggestTag(file.name, file.type)]))
  );

  function handleConfirm() {
    onConfirm(files.map((file, index) => ({ file, document_type: tags[index] })));
  }

  return (
    <Dialog labelledBy="tag-dialog-title">
      <h2 id="tag-dialog-title" className="text-xl font-bold text-slate-900">Tag your files</h2>
      <p className="mt-2 text-sm text-slate-600">
        Tags are optional. We have suggested one for each file from its name. Change any that are wrong, then upload.
      </p>

      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {files.map((file, index) => (
          <li key={`${file.name}-${index}`} className="grid gap-2 p-3 sm:grid-cols-[1fr_200px] sm:items-center">
            <div className="min-w-0">
              <p className="break-all font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{formatKB(file.size)}</p>
            </div>
            <label className="sr-only" htmlFor={`tag-${index}`}>Tag for {file.name}</label>
            <select
              id={`tag-${index}`}
              className="input"
              value={tags[index]}
              onChange={(e) => setTags((current) => ({ ...current, [index]: e.target.value }))}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleConfirm}>
          Upload {files.length} {files.length === 1 ? "file" : "files"}
        </button>
      </div>
    </Dialog>
  );
}
